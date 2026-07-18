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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
