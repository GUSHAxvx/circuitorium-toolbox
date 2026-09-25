// 本地工具箱数据模型：与具体存储实现无关
// 浏览器用 IndexedDB（Dexie），Tauri 版可换成 SQLite/文件系统实现同一套接口

export type ImageKind = 'schematic' | 'circuit' | 'wiring' | 'photo';

/**
 * 项目难度：
 * - shikai「始解」：搭起来就行，不用写代码（原有功能就是始解的默认功能，不改动）
 * - bankai「卍解」：要写代码 / 程序，项目里多出「程序代码」等更细的功能
 */
export type ProjectDifficulty = 'shikai' | 'bankai';

export const DIFFICULTY_LABEL: Record<ProjectDifficulty, { name: string; hint: string; short: string }> = {
  shikai: { name: '始解', hint: '搭起来就行，不用写代码', short: '不用写代码' },
  bankai: { name: '卍解', hint: '要写代码 / 程序，项目里能放代码文件', short: '要写代码' },
};

/** 卍解项目里的一段程序代码 */
export interface ToolboxCodeFile {
  id: string;
  projectId: string;
  /** 文件名，例如 blink.ino / main.c / project.uvprojx */
  name: string;
  /** 语言标记（ino / py / cpp / Keil 工程…），用来说明和显示 */
  language: string;
  /** 分组：主程序 / 头文件 / 库文件 / 工程文件 / 汇编 / 其它 */
  group?: string;
  /** 代码正文 */
  content: string;
  /** 这段代码是干嘛的（可选） */
  note: string;
  /** 原文件编码（Keil 默认 GBK，读进来时转过码） */
  encoding?: string;
  sortOrder: number;
  createdAt: string;
}

/** 卍解项目：接线表的一行（哪个模块的哪只脚，接到开发板的哪只脚） */
export interface ToolboxPinRow {
  id: string;
  projectId: string;
  /** 模块 / 元件名，例如 超声波 HC-SR04 */
  module: string;
  /** 模块这头的引脚，例如 TRIG */
  pin: string;
  /** 开发板这头的引脚，例如 D2 */
  boardPin: string;
  /** 补充说明，例如「要串 1k 电阻」 */
  note: string;
  sortOrder: number;
  createdAt: string;
}

/** 卍解项目：调试记录（踩过的坑与解决办法） */
export interface ToolboxDebugNote {
  id: string;
  projectId: string;
  /** 出了什么问题 */
  problem: string;
  /** 怎么解决的 */
  solution: string;
  sortOrder: number;
  createdAt: string;
}

/** 代码分组（顺序就是界面上的顺序） */
export const CODE_GROUPS = ['主程序', '头文件', '库文件', '工程文件', '汇编', '其它'] as const;
export type CodeGroup = (typeof CODE_GROUPS)[number];

/** 项目（作品） */
export interface ToolboxProject {
  id: string;
  name: string;
  /** 一句话简介 */
  notes: string;
  /** 详细描述 */
  description: string;
  /** 主要功能，每行一条 */
  features: string;
  /** 来源信息：自己新建 / 来自模板 / 来自收到的作品文件 */
  source: ProjectSource;
  /** 难度：始解 / 卍解；老的作品没有这个字段，一律当始解 */
  difficulty?: ProjectDifficulty;
  /** 卍解项目：开发环境 / 要用到的库 */
  codeNote?: string;
  views: number;
  /** 本地统计：被「做同款」的次数 */
  remixCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSource {
  type: 'manual' | 'template' | 'shared' | 'sample';
  /** 模板 id 或原作者名（分享作品时写入） */
  ref?: string;
  author?: string;
  version?: string;
}

/** 元器件（手动添加或 AI 识别结果，两者同一结构） */
export interface ToolboxComponent {
  id: string;
  projectId: string;
  name: string;
  type: string;
  model: string;
  manufacturer: string;
  packageType: string;
  pinCount: number;
  specifications: string;
  description: string;
  annotation: string;
  quantity: number;
  /** 备料是否已齐 */
  checked: boolean;
  /** 识别置信度 0~1；手动添加为 0 */
  confidence: number;
  sortOrder: number;
  createdAt: string;
  /** 这一行来自元件库里的哪个元件（有的话）；导出作品时会跟着走 */
  libraryId?: string;
}

/** 项目图片：图片二进制直接存在本地库里 */
export interface ToolboxImage {
  id: string;
  projectId: string;
  kind: ImageKind;
  description: string;
  mime: string;
  size: number;
  blob: Blob;
  createdAt: string;
}

/** 图文教程小节 */
export interface ToolboxSection {
  id: string;
  projectId: string;
  type: 'step' | 'note';
  title: string;
  content: string;
  sortOrder: number;
}

/** 内置项目模板（离线自带，不需要服务器） */
export interface ToolboxTemplate {
  id: string;
  name: string;
  emoji: string;
  category: string;
  difficulty: string;
  description: string;
  sortOrder: number;
  components: Array<Omit<ToolboxComponent, 'id' | 'projectId' | 'createdAt'>>;
  sections: Array<Omit<ToolboxSection, 'id' | 'projectId'>>;
}

/** 键值设置（AI Key 等只存在本机） */
export interface ToolboxSetting {
  key: string;
  value: string;
  updatedAt: string;
}

/** 列表页用的项目摘要 */
export interface ProjectSummary {
  id: string;
  name: string;
  notes: string;
  source: ProjectSource;
  /** 难度：始解 / 卍解（没存过的一律当始解） */
  difficulty?: ProjectDifficulty;
  /** 卍解项目的代码文件数 */
  codeCount?: number;
  componentCount: number;
  imageCount: number;
  coverImageId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 项目完整数据（详情页/导出都用它） */
export interface ProjectBundle {
  project: ToolboxProject;
  components: ToolboxComponent[];
  sections: ToolboxSection[];
  images: ToolboxImage[];
  /** 程序代码（只有卍解项目会有） */
  codeFiles?: ToolboxCodeFile[];
  /** 接线表（卍解） */
  pinRows?: ToolboxPinRow[];
  /** 调试记录（卍解） */
  debugNotes?: ToolboxDebugNote[];
}

/** 一次性导入用的完整数据（id 由存储层生成） */
export interface ImportedBundle {
  project: Omit<ToolboxProject, 'id'>;
  components: Array<Omit<ToolboxComponent, 'id' | 'projectId'>>;
  sections: Array<Omit<ToolboxSection, 'id' | 'projectId'>>;
  images: Array<Omit<ToolboxImage, 'id' | 'projectId'>>;
  codeFiles?: Array<Omit<ToolboxCodeFile, 'id' | 'projectId'>>;
  pinRows?: Array<Omit<ToolboxPinRow, 'id' | 'projectId'>>;
  debugNotes?: Array<Omit<ToolboxDebugNote, 'id' | 'projectId'>>;
}

/** 详情页展示用的统计 */
export interface LocalStats {
  componentCount: number;
  imageCount: number;
  fileSizeBytes: number;
  projectType: string;
  avgConfidence: number;
  scenarioTags: string[];
  componentTypes: string[];
  checkedCount: number;
}

/** 手动添加元件的输入（AI 识别走的也是这个入口） */
export interface ComponentInput {
  name: string;
  /** 从元件库挑的元件：记下它的编号，导出作品时会带上快照 */
  libraryId?: string;
  type?: string;
  model?: string;
  manufacturer?: string;
  packageType?: string;
  pinCount?: number;
  specifications?: string;
  description?: string;
  annotation?: string;
  quantity?: number;
  confidence?: number;
}

/**
 * 元件库数据模型。
 *
 * 内置库随软件打包、只读；用户库存在本机，可读写。查询时两个库合并，同一个 id 以用户库为准。
 * 作品文件（.ecp）里会带一份 components_snapshot，别人打开时可以把新元件收进自己的库。
 */
export type LibrarySource = 'builtin' | 'user_created' | 'imported' | 'ai_temp';

export interface LibraryComponentInput {
  id?: string;
  name: string;
  aliases?: string[];
  category: string;
  purpose: string;
  appearance: string;
  polarity: string;
  commonModels?: string[];
  pinCount?: number;
  package?: string;
  family?: string;
  specs?: Record<string, string>;
  commonMistakes?: string[];
  howToRead: string;
  usedInProjects?: string[];
  tags?: string[];
  /** 图片二进制（用户自建 / AI 临时元件用；内置元件走静态路径，不用这个） */
  image?: Blob | null;
  source: LibrarySource;
  verified?: boolean;
  author?: string;
  /** 从哪件作品带进来的（source: imported 时记） */
  fromProject?: string;
  createdAt?: string;
}

export interface LibraryComponent extends LibraryComponentInput {
  id: string;
  /** 可直接显示的图片地址：内置是 /library/xxx.png，用户元件是 blob 地址 */
  imageUrl?: string;
  /** 图形署名（用了第三方图形的元件要带上） */
  imageCredit?: string;
}

/**
 * 工具箱数据接口。
 * 现在由 IndexedDB 实现；Tauri 版会提供同样的 SQLite 实现，界面代码不需要改。
 */
export interface ToolboxStore {
  ready(): Promise<void>;

  // ===== 元件库 =====
  /** 内置 + 用户自己的，合并后返回（同一个 id 以用户库为准） */
  listLibrary(): Promise<LibraryComponent[]>;
  getLibraryComponent(id: string): Promise<LibraryComponent | null>;
  /** 存进用户库（用户自建 / AI 临时 / 从作品导入） */
  saveLibraryComponent(input: LibraryComponentInput): Promise<string>;
  /** 只删用户库里的；内置的删不掉 */
  removeLibraryComponent(id: string): Promise<void>;
  /** 从作品里带进来的元件：同 id 跳过、同名不同 id 都保留 */
  importLibraryComponents(
    items: LibraryComponentInput[],
    fromProject?: string
  ): Promise<{ added: LibraryComponent[]; skipped: LibraryComponent[] }>;
  /** 用户自建元件的图片（存在本地存储里，返回可直接显示的地址） */
  libraryImageUrl(id: string): Promise<string | null>;

  listProjects(): Promise<ProjectSummary[]>;
  getProject(id: string): Promise<ProjectBundle | null>;
  createProject(input: { name: string; notes?: string; source?: ProjectSource; difficulty?: ProjectDifficulty }): Promise<string>;
  updateProject(
    id: string,
    patch: Partial<Pick<ToolboxProject,
      'name' | 'notes' | 'description' | 'features' | 'views' | 'remixCount' | 'source'
      | 'difficulty' | 'codeNote'>>
  ): Promise<void>;
  deleteProject(id: string): Promise<void>;
  /** 「做同款」：复制出一个属于自己的副本 */
  duplicateProject(id: string, options?: { name?: string; source?: ProjectSource }): Promise<string>;
  /** 一次性导入完整作品（打开别人给的作品文件时用） */
  importBundle(bundle: ImportedBundle): Promise<string>;

  addComponent(projectId: string, input: ComponentInput): Promise<string>;
  updateComponent(id: string, patch: Partial<ToolboxComponent>): Promise<void>;
  removeComponent(id: string): Promise<void>;

  addSection(projectId: string, input: { type?: 'step' | 'note'; title: string; content?: string }): Promise<string>;
  updateSection(id: string, patch: Partial<ToolboxSection>): Promise<void>;
  removeSection(id: string): Promise<void>;

  addImage(projectId: string, file: Blob, kind: ImageKind, description?: string): Promise<string>;
  removeImage(id: string): Promise<void>;
  /** 取出可显示的图片地址（内部缓存 objectURL，记得在组件卸载时释放） */
  imageUrl(imageId: string | null | undefined): Promise<string | null>;
  releaseImageUrls(): void;

  // ===== 程序代码（卍解项目）=====
  /** 这个项目里的代码文件，按顺序 */
  listCodeFiles(projectId: string): Promise<ToolboxCodeFile[]>;
  addCodeFile(projectId: string, input: {
    name: string; language?: string; content: string; note?: string; group?: string; encoding?: string;
  }): Promise<string>;
  updateCodeFile(id: string, patch: Partial<ToolboxCodeFile>): Promise<void>;
  removeCodeFile(id: string): Promise<void>;

  // ===== 接线表（卍解项目）=====
  listPinRows(projectId: string): Promise<ToolboxPinRow[]>;
  addPinRow(projectId: string, input: { module: string; pin?: string; boardPin?: string; note?: string }): Promise<string>;
  updatePinRow(id: string, patch: Partial<ToolboxPinRow>): Promise<void>;
  removePinRow(id: string): Promise<void>;

  // ===== 调试记录（卍解项目）=====
  listDebugNotes(projectId: string): Promise<ToolboxDebugNote[]>;
  addDebugNote(projectId: string, input: { problem: string; solution?: string }): Promise<string>;
  updateDebugNote(id: string, patch: Partial<ToolboxDebugNote>): Promise<void>;
  removeDebugNote(id: string): Promise<void>;

  stats(projectId: string): Promise<LocalStats>;

  listTemplates(): Promise<ToolboxTemplate[]>;
  instantiateTemplate(templateId: string, options?: { name?: string }): Promise<string>;

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  deleteSetting(key: string): Promise<void>;

  /** 估算已用空间（字节），用于「工具箱体积」展示 */
  estimateUsage(): Promise<number>;
}
