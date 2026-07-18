import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";

const emailSchema = z.string().trim().email("请输入有效邮箱地址。");

export function isAnonymousUser(user: User | null): boolean {
  return user?.is_anonymous === true;
}

export async function signInAsGuest(client: SupabaseClient): Promise<User> {
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("匿名身份未创建。请检查 Supabase 匿名登录设置。");
  return data.user;
}

export async function sendEmailMagicLink(
  client: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<void> {
  const validatedEmail = emailSchema.parse(email);
  const { error } = await client.auth.signInWithOtp({
    email: validatedEmail,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

export async function linkGuestToEmail(
  client: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<void> {
  const validatedEmail = emailSchema.parse(email);
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!isAnonymousUser(sessionData.session?.user ?? null)) {
    throw new Error("当前身份不是游客，不能执行游客升级。");
  }

  const { error } = await client.auth.updateUser(
    { email: validatedEmail },
    { emailRedirectTo: redirectTo },
  );
  if (error) throw error;
}

