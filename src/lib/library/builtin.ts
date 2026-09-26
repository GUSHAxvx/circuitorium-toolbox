// 内置元件库（随软件打包，只读）
//
// 数据来源：元件数据库/ 那条流水线（从元件库提取技术参数 + 补教学文案）
// 这个文件不要手改：跑 `npm run sync:library` 会从 元件数据库/数据/components.json 重新生成本文件，
// 并把元件图拷到 public/library/。

import raw from './builtin.json';
import type { LibraryComponent } from '@/lib/store/types';

interface BuiltinEntry {
  id: string;
  name: string;
  aliases?: string[];
  category: string;
  purpose: string;
  appearance: string;
  polarity: string;
  commonModels?: string[];
  commonMistakes?: string[];
  howToRead: string;
  usedInProjects?: string[];
  tags?: string[];
  pinCount?: number;
  pinNames?: string[];
  package?: string;
  family?: string;
  specs?: Record<string, string>;
  imagePath: string;
  imageCredit?: string;
}

const entries = (raw as unknown as { components: BuiltinEntry[] }).components;

export const BUILTIN_LIBRARY: LibraryComponent[] = entries.map((e) => ({
  ...e,
  source: 'builtin',
  verified: true,
  // 静态导出后图片在 /library/<id>.png（imagePath 由同步脚本写入）
  imageUrl: `/${e.imagePath}`,
  imageCredit: e.imageCredit || '元件图形来自 Fritzing（CC BY-SA 3.0）',
}));

export const BUILTIN_LIBRARY_IDS = new Set(BUILTIN_LIBRARY.map((c) => c.id));

/** 分类顺序（界面上按这个顺序排筛选按钮） */
export const LIBRARY_CATEGORIES = ['基础元件', '电源', '开关', '输出', '传感器', '模块', '工具'] as const;
