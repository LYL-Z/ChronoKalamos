import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  assertUploadBytes,
  matchesDeclaredImageMagic,
  sanitizeUploadFilename,
  validateUpload,
} from "./uploads";

function pngBytes() {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
}

function jpegBytes() {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
}

function webpBytes() {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x08, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]);
}

describe("private upload validation", () => {
  it("accepts only the three configured image formats", () => {
    expect(validateUpload({ name: "map.webp", type: "image/webp", size: 1024 })).toMatchObject({
      type: "image/webp",
      size: 1024,
    });
    expect(() => validateUpload({ name: "map.svg", type: "image/svg+xml", size: 1024 })).toThrow();
  });

  it("rejects empty and oversized files", () => {
    expect(() => validateUpload({ name: "empty.png", type: "image/png", size: 0 })).toThrow();
    expect(() => validateUpload({ name: "large.jpg", type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 })).toThrow();
  });

  it("matches PNG, JPEG, and WebP magic independently of the file name", () => {
    expect(matchesDeclaredImageMagic(pngBytes(), "image/png")).toBe(true);
    expect(matchesDeclaredImageMagic(jpegBytes(), "image/jpeg")).toBe(true);
    expect(matchesDeclaredImageMagic(webpBytes(), "image/webp")).toBe(true);
    expect(matchesDeclaredImageMagic(pngBytes(), "image/jpeg")).toBe(false);
    expect(matchesDeclaredImageMagic(new TextEncoder().encode("<svg></svg>"), "image/png")).toBe(false);
  });

  it("rejects a PNG declared as JPEG before any storage write", async () => {
    const file = new Blob([pngBytes().buffer], { type: "image/jpeg" });
    await expect(assertUploadBytes(file, "image/jpeg")).rejects.toThrow("文件内容与声明的图片类型不符");
    await expect(assertUploadBytes(new Blob([pngBytes().buffer]), "image/png")).resolves.toBeUndefined();
  });

  it("removes path separators and control punctuation from object names", () => {
    expect(sanitizeUploadFilename("../账簿 / spring.png")).toBe("spring.png");
    expect(sanitizeUploadFilename("...")).toBe("upload");
  });
});

