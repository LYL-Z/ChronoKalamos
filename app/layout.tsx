import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChronoKalamos · 742 CE Chang’an",
  description: "一个有史料边界的 AI 历史人生模拟器，从742年的长安开始。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

function publicSupabaseConfigScript(): string {
  const config = JSON.stringify({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ?? process.env.SUPABASE_PUBLISHABLE_KEY
      ?? "",
    turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      ?? process.env.TURNSTILE_SITE_KEY
      ?? "",
  });
  return config.replace(/</g, "\\u003c");
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <script
          id="chronokalamos-public-config"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: publicSupabaseConfigScript() }}
        />
        {children}
      </body>
    </html>
  );
}
