import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const USER_UPLOAD_BUCKET = "user-uploads";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

const uploadDescriptorSchema = z.object({
  name: z.string().min(1),
  type: z.enum(ALLOWED_UPLOAD_MIME_TYPES, {
    error: "只允许 PNG、JPEG 和 WebP 图片。",
  }),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "图片不得超过 5 MiB。"),
});

export type UserUploadRecord = {
  id: string;
  owner_id: string;
  storage_path: string;
  original_name: string;
  mime_type: (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];
  size_bytes: number;
  status: "ready" | "deleted";
};

export function validateUpload(file: Pick<File, "name" | "type" | "size">) {
  return uploadDescriptorSchema.parse(file);
}

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.length <= bytes.length && prefix.every((value, index) => bytes[index] === value);
}

export function matchesDeclaredImageMagic(
  bytes: Uint8Array,
  declaredType: (typeof ALLOWED_UPLOAD_MIME_TYPES)[number],
): boolean {
  if (declaredType === "image/png") {
    return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (declaredType === "image/jpeg") {
    return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
  }
  return bytes.length >= 12
    && hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50;
}

export async function assertUploadBytes(
  file: Pick<Blob, "size" | "slice">,
  declaredType: (typeof ALLOWED_UPLOAD_MIME_TYPES)[number],
): Promise<void> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("图片不得超过 5 MiB。");
  }
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!matchesDeclaredImageMagic(bytes, declaredType)) {
    throw new Error("文件内容与声明的图片类型不符。");
  }
}

export function sanitizeUploadFilename(name: string): string {
  const normalized = name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const safe = normalized.replace(/^[.-]+|[.-]+$/g, "").slice(0, 96);
  return safe || "upload";
}

export async function uploadPrivateImage(
  client: SupabaseClient,
  file: File,
): Promise<UserUploadRecord> {
  const descriptor = validateUpload(file);
  await assertUploadBytes(file, descriptor.type);
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("请先创建游客身份或登录邮箱账户。");

  const uploadId = window.crypto.randomUUID();
  const storagePath = `${userData.user.id}/${uploadId}/${sanitizeUploadFilename(descriptor.name)}`;
  const { error: storageError } = await client.storage
    .from(USER_UPLOAD_BUCKET)
    .upload(storagePath, file, { contentType: descriptor.type, upsert: false });
  if (storageError) throw storageError;

  const metadata = {
    id: uploadId,
    owner_id: userData.user.id,
    bucket_id: USER_UPLOAD_BUCKET,
    storage_path: storagePath,
    original_name: descriptor.name,
    mime_type: descriptor.type,
    size_bytes: descriptor.size,
    status: "ready" as const,
  };
  const { data, error: metadataError } = await client
    .from("user_uploads")
    .insert(metadata)
    .select("id,owner_id,storage_path,original_name,mime_type,size_bytes,status")
    .single();

  if (metadataError) {
    await client.storage.from(USER_UPLOAD_BUCKET).remove([storagePath]);
    throw metadataError;
  }

  return data as UserUploadRecord;
}

export async function deletePrivateUpload(
  client: SupabaseClient,
  upload: Pick<UserUploadRecord, "id" | "storage_path">,
): Promise<void> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("当前没有可用身份。");

  const expectedPrefix = `${userData.user.id}/`;
  if (!upload.storage_path.startsWith(expectedPrefix)) {
    throw new Error("上传路径不属于当前用户。");
  }

  const { error: storageError } = await client.storage
    .from(USER_UPLOAD_BUCKET)
    .remove([upload.storage_path]);
  if (storageError) throw storageError;

  const { error: metadataError } = await client
    .from("user_uploads")
    .delete()
    .eq("id", upload.id)
    .eq("owner_id", userData.user.id);
  if (metadataError) throw metadataError;
}

