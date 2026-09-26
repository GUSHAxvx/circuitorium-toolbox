import type { NextConfig } from "next";

// 两种构建：
//   默认            —— 服务器版（浏览器 + API 路由 + SQLite）
//   TOOLBOX_EXPORT=1 —— 便携版：纯静态导出（无服务器、无 API），供本地工具箱分发
const isToolboxExport = process.env.TOOLBOX_EXPORT === "1";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // 开发时用 127.0.0.1 访问也要算「自己人」：
  // 验证脚本（工具/browser-check.cjs）走的是 127.0.0.1:3000，Next 新版本默认会拦跨源开发请求
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // 让界面自己知道"我是不是独立版"：
  //   独立版（便携版 / 桌面版）只有工具箱这一页，导航里不能出现项目/社区这些不存在的页面；
  //   服务器版里工具箱只是其中一页，必须保留回首页/项目的入口。
  env: {
    NEXT_PUBLIC_STANDALONE: isToolboxExport ? "1" : "0",
  },
  // better-sqlite3 / sharp 为原生模块，需外部化处理，避免打包构建失败
  serverExternalPackages: ["better-sqlite3", "sharp"],
  ...(isToolboxExport
    ? {
        output: "export" as const,
        // 静态导出没有图片优化服务
        images: { unoptimized: true },
        // 便携版直接以文件形式提供，用目录式路径更稳（/toolbox/ → /toolbox/index.html）
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
