import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 本地工具脚本（Node 环境，用 require 是正常的，不参与 Next 应用规则）
    "工具/**",
    // 便携版构建产物（压缩后的静态资源，不参与 lint）
    "便携版/**",
    ".portable-build/**",
  ]),
]);

export default eslintConfig;
