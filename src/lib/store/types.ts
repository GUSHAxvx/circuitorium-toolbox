// 本地工具箱数据模型：与具体存储实现无关
// 浏览器用 IndexedDB（Dexie），Tauri 版可换成 SQLite/文件系统实现同一套接口

export type ImageKind = 'schematic' | 'circuit' | 'wiring' | 'photo';

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
}

/** 一次性导入用的完整数据（id 由存储层生成） */
export interface ImportedBundle {
  project: Omit<ToolboxProject, 'id'>;
  components: Array<Omit<ToolboxComponent, 'id' | 'projectId'>>;
  sections: Array<Omit<ToolboxSection, 'id' | 'projectId'>>;
  images: Array<Omit<ToolboxImage, 'id' | 'projectId'>>;
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
  createProject(input: { name: string; notes?: string; source?: ProjectSource }): Promise<string>;
  updateProject(
    id: string,
    patch: Partial<Pick<ToolboxProject, 'name' | 'notes' | 'description' | 'features' | 'views' | 'remixCount' | 'source'>>
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

  stats(projectId: string): Promise<LocalStats>;

  listTemplates(): Promise<ToolboxTemplate[]>;
  instantiateTemplate(templateId: string, options?: { name?: string }): Promise<string>;

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  deleteSetting(key: string): Promise<void>;

  /** 估算已用空间（字节），用于「工具箱体积」展示 */
  estimateUsage(): Promise<number>;
}
