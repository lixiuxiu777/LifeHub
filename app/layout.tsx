import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LifeHub · 生活，有序生长",
  description: "LifeHub 个人生活仪表盘，统一管理日常与成长。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head><meta name="color-scheme" content="light dark"/><link rel="stylesheet" href="/styles.css"/><link rel="stylesheet" href="/life.css"/></head>
      <body>{children}</body>
    </html>
  );
}
