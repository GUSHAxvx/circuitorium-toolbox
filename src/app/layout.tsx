import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CIRCUITORIUM - 电子知识平台",
  description: "让电子知识不再碎片化",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a18",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={inter.className} style={{ margin: 0, padding: 0, boxSizing: 'border-box' }}>
        <style>{`*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'PingFang SC','HarmonyOS Sans SC','Microsoft YaHei','Segoe UI',sans-serif;background:#0a0a18;min-height:100vh;-webkit-font-smoothing:antialiased}::selection{background:rgba(102,126,234,.45);color:#fff}html{scroll-behavior:smooth}::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-track{background:#0a0a18}::-webkit-scrollbar-thumb{background:rgba(124,138,255,.3);border-radius:6px}::-webkit-scrollbar-thumb:hover{background:rgba(124,138,255,.55)}`}</style>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
