// 本地工具箱存储实现：IndexedDB（Dexie）
// 界面只依赖 ToolboxStore 接口，将来 Tauri 版换成 SQLite 实现即可，无需改 UI

import Dexie, { type Table } from 'dexie';
import { deriveScenarioTags } from '@/lib/scenarioTags';
import { compressImage } from '@/lib/images';
import { BUILTIN_LIBRARY, BUILTIN_LIBRARY_IDS } from '@/lib/library/builtin';
import { TEMPLATE_SEED } from './templateSeed';
import { SAMPLE_SEED } from './sampleSeed';
import type {
  ComponentInput,
  ImageKind,
  ImportedBundle,
  LibraryComponent,
  LibraryComponentInput,
  LocalStats,
  ProjectBundle,
  ProjectDifficulty,
  ProjectSource,
  ProjectSummary,
  ToolboxCodeFile,
  ToolboxComponent,
  ToolboxDebugNote,
  ToolboxPinRow,
  ToolboxImage,
  ToolboxProject,
  ToolboxSection,
  ToolboxSetting,
  ToolboxStore,
  ToolboxTemplate,
} from './types';

const DB_NAME = 'circuitorium-toolbox';
/** 示例作品是否已写入过（只写一次，用户删掉后不会再自动回来） */
const SAMPLE_FLAG = '__samples_seeded';

/** 代码文件的体积上限：单个 200KB、一个项目 20 个（够放课堂作业了） */
export const CODE_LIMITS = { maxChars: 200_000, maxFiles: 20 };

/** 按扩展名猜语言标记（只用来显示，不影响内容） */
function guessLanguage(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    ino: 'Arduino', pde: 'Arduino', py: 'Python', c: 'C', h: 'C 头文件', cpp: 'C++', hpp: 'C++ 头文件',
    js: 'JavaScript', ts: 'TypeScript', json: '配置', txt: '文本', md: '说明', sh: 'Shell', mix: 'Mixly',
    // Keil（MDK-ARM / C51）那一套
    uvproj: 'Keil 工程', uvprojx: 'Keil 工程', uvopt: 'Keil 配置', uvoptx: 'Keil 配置',
    sct: '分散加载', s: '汇编', asm: '汇编', a51: '汇编', inc: '汇编头文件',
    hex: 'HEX 固件', map: '链接映射', lst: '编译列表', axf: '调试文件', lib: '库文件',
  };
  return map[ext] || (ext ? ext.toUpperCase() : '文本');
}

/** 按文件名与内容猜分组（主程序 / 头文件 / 库文件 / 工程文件 / 汇编 / 其它） */
export function guessCodeGroup(name: string, content = ''): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['uvproj', 'uvprojx', 'uvopt', 'uvoptx', 'sct', 'map', 'lst', 'hex'].includes(ext)) return '工程文件';
  if (['s', 'asm', 'a51', 'inc'].includes(ext)) return '汇编';
  if (['h', 'hpp'].includes(ext)) return '头文件';
  if (['c', 'cpp'].includes(ext)) {
    return /\b(int|void)\s+main\s*\(/.test(content) ? '主程序' : '库文件';
  }
  if (['ino', 'pde'].includes(ext)) return '主程序';
  if (['py', 'js', 'ts', 'mix'].includes(ext)) return '主程序';
  return '其它';
}

/** 用户库里的元件：图片存二进制，其余字段与 LibraryComponent 一致 */
type StoredLibraryComponent = Omit<LibraryComponent, 'image' | 'imageUrl'> & { image?: Blob | null };

class ToolboxDB extends Dexie {
  projects!: Table<ToolboxProject, string>;
  components!: Table<ToolboxComponent, string>;
  sections!: Table<ToolboxSection, string>;
  images!: Table<ToolboxImage, string>;
  templates!: Table<ToolboxTemplate, string>;
  settings!: Table<ToolboxSetting, string>;
  /** 用户自己的元件库（内置库不在这里，是打包在软件里的只读数据） */
  library!: Table<StoredLibraryComponent, string>;
  /** 卍解项目的程序代码 */
  codeFiles!: Table<ToolboxCodeFile, string>;
  /** 卍解项目的接线表 */
  pinRows!: Table<ToolboxPinRow, string>;
  /** 卍解项目的调试记录 */
  debugNotes!: Table<ToolboxDebugNote, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      projects: 'id, updatedAt, name',
      components: 'id, projectId, sortOrder',
      sections: 'id, projectId, sortOrder',
      images: 'id, projectId, createdAt',
      templates: 'id, sortOrder',
      settings: 'key',
    });
    // v2：加元件库（用户自建 / AI 临时 / 从作品导入）
    this.version(2).stores({
      library: 'id, source, category, name, createdAt',
    });
    // v3：加卍解项目的程序代码（只是新增一张表，老数据不动）
    this.version(3).stores({
      codeFiles: 'id, projectId, sortOrder',
    });
    // v4：卍解再加接线表与调试记录（同样只加表）
    this.version(4).stores({
      pinRows: 'id, projectId, sortOrder',
      debugNotes: 'id, projectId, sortOrder',
    });
  }
}

let dbInstance: ToolboxDB | null = null;

function db(): ToolboxDB {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    throw new Error('本地存储仅在浏览器/桌面应用中可用');
  }
  if (!dbInstance) dbInstance = new ToolboxDB();
  return dbInstance;
}

function newId(prefix = ''): string {
  const raw = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${raw}` : raw;
}

const nowIso = () => new Date().toISOString();

const emptySource = (): ProjectSource => ({ type: 'manual' });

class LocalToolboxStore implements ToolboxStore {
  private opened: Promise<void> | null = null;
  private urlCache = new Map<string, string>();
  /** 用户自建元件的图片地址缓存（内置元件走静态路径，不进这里） */
  private libraryUrlCache = new Map<string, string>();

  ready(): Promise<void> {
    if (!this.opened) {
      this.opened = (async () => {
        const database = db();
        await database.open();
        // 首次运行：写入内置模板，保证断网也有内容
        const count = await database.templates.count();
        if (count === 0) {
          await database.templates.bulkPut(TEMPLATE_SEED);
        }
        // 首次运行：写入示例作品，让新人一打开就看到"做完是什么样"
        const seeded = await database.settings.get(SAMPLE_FLAG);
        if (!seeded) {
          await this.seedSamples();
          await database.settings.put({ key: SAMPLE_FLAG, value: '1', updatedAt: nowIso() });
        }
      })();
    }
    return this.opened;
  }

  /** 用内置模板生成示例作品（含完善描述，并标记部分元件为已备齐） */
  private async seedSamples(): Promise<void> {
    const database = db();
    for (const sample of SAMPLE_SEED) {
      const template = await database.templates.get(sample.templateId);
      if (!template) continue;

      const projectId = newId('prj');
      const ts = nowIso();
      await database.projects.add({
        id: projectId,
        name: sample.name,
        notes: sample.notes,
        description: sample.description,
        features: sample.features,
        source: { type: 'sample', ref: template.id },
        views: 0,
        remixCount: 0,
        createdAt: ts,
        updatedAt: ts,
      });

      for (const [index, c] of template.components.entries()) {
        await database.components.add({
          ...c,
          id: newId('cmp'),
          projectId,
          checked: index < sample.checkedCount,
          createdAt: ts,
        });
      }
      for (const s of template.sections) {
        await database.sections.add({ ...s, id: newId('sec'), projectId });
      }
    }
  }

  // ===== 项目 =====
  async listProjects(): Promise<ProjectSummary[]> {
    await this.ready();
    const database = db();
    const projects = await database.projects.orderBy('updatedAt').reverse().toArray();
    const summaries: ProjectSummary[] = [];

    for (const p of projects) {
      const components = await database.components.where('projectId').equals(p.id).toArray();
      const images = await database.images.where('projectId').equals(p.id).toArray();
      const difficulty: ProjectDifficulty = p.difficulty === 'bankai' ? 'bankai' : 'shikai';
      const codeCount = difficulty === 'bankai'
        ? await database.codeFiles.where('projectId').equals(p.id).count()
        : 0;
      summaries.push({
        id: p.id,
        name: p.name,
        notes: p.notes,
        source: p.source ?? emptySource(),
        difficulty,
        codeCount,
        componentCount: components.length,
        imageCount: images.length,
        coverImageId: images.length > 0 ? images[images.length - 1].id : null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      });
    }
    return summaries;
  }

  async getProject(id: string): Promise<ProjectBundle | null> {
    await this.ready();
    const database = db();
    const project = await database.projects.get(id);
    if (!project) return null;

    const [components, sections, images, codeFiles, pinRows, debugNotes] = await Promise.all([
      database.components.where('projectId').equals(id).toArray(),
      database.sections.where('projectId').equals(id).toArray(),
      database.images.where('projectId').equals(id).toArray(),
      database.codeFiles.where('projectId').equals(id).toArray(),
      database.pinRows.where('projectId').equals(id).toArray(),
      database.debugNotes.where('projectId').equals(id).toArray(),
    ]);

    return {
      project,
      components: components.sort((a, b) => a.sortOrder - b.sortOrder),
      sections: sections.sort((a, b) => a.sortOrder - b.sortOrder),
      images: images.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      codeFiles: codeFiles.sort((a, b) => a.sortOrder - b.sortOrder),
      pinRows: pinRows.sort((a, b) => a.sortOrder - b.sortOrder),
      debugNotes: debugNotes.sort((a, b) => a.sortOrder - b.sortOrder),
    };
  }

  async createProject(input: { name: string; notes?: string; source?: ProjectSource; difficulty?: ProjectDifficulty }): Promise<string> {
    await this.ready();
    const id = newId('prj');
    const ts = nowIso();
    await db().projects.add({
      id,
      name: input.name.trim() || '未命名项目',
      notes: input.notes ?? '',
      description: '',
      features: '',
      source: input.source ?? emptySource(),
      difficulty: input.difficulty ?? 'shikai',
      views: 0,
      remixCount: 0,
      createdAt: ts,
      updatedAt: ts,
    });
    return id;
  }

  // ===== 程序代码（卍解项目）=====
  async listCodeFiles(projectId: string): Promise<ToolboxCodeFile[]> {
    await this.ready();
    const list = await db().codeFiles.where('projectId').equals(projectId).toArray();
    return list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async addCodeFile(projectId: string, input: {
    name: string; language?: string; content: string; note?: string; group?: string; encoding?: string;
  }): Promise<string> {
    await this.ready();
    const database = db();
    const existing = await database.codeFiles.where('projectId').equals(projectId).toArray();
    const id = newId('code');
    const name = input.name.trim() || `代码${existing.length + 1}.txt`;
    const content = input.content.slice(0, CODE_LIMITS.maxChars);
    await database.codeFiles.add({
      id,
      projectId,
      name,
      language: (input.language || guessLanguage(name)).trim(),
      group: (input.group || guessCodeGroup(name, content)).trim(),
      content,
      note: (input.note || '').slice(0, 200),
      encoding: input.encoding || 'utf-8',
      sortOrder: existing.length,
      createdAt: nowIso(),
    });
    await database.projects.update(projectId, { updatedAt: nowIso() });
    return id;
  }

  async updateCodeFile(id: string, patch: Partial<ToolboxCodeFile>): Promise<void> {
    await this.ready();
    const clean = { ...patch } as Record<string, unknown>;
    delete clean.id;
    delete clean.projectId;
    delete clean.createdAt;
    if (typeof clean.content === 'string') clean.content = (clean.content as string).slice(0, CODE_LIMITS.maxChars);
    await db().codeFiles.update(id, clean as Partial<ToolboxCodeFile>);
  }

  async removeCodeFile(id: string): Promise<void> {
    await this.ready();
    await db().codeFiles.delete(id);
  }

  // ===== 接线表（卍解项目）=====
  async listPinRows(projectId: string): Promise<ToolboxPinRow[]> {
    await this.ready();
    const list = await db().pinRows.where('projectId').equals(projectId).toArray();
    return list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async addPinRow(projectId: string, input: { module: string; pin?: string; boardPin?: string; note?: string }): Promise<string> {
    await this.ready();
    const database = db();
    const existing = await database.pinRows.where('projectId').equals(projectId).toArray();
    const id = newId('pin');
    await database.pinRows.add({
      id,
      projectId,
      module: (input.module || '').trim().slice(0, 60) || '未命名模块',
      pin: (input.pin || '').trim().slice(0, 40),
      boardPin: (input.boardPin || '').trim().slice(0, 40),
      note: (input.note || '').trim().slice(0, 120),
      sortOrder: existing.length,
      createdAt: nowIso(),
    });
    await database.projects.update(projectId, { updatedAt: nowIso() });
    return id;
  }

  async updatePinRow(id: string, patch: Partial<ToolboxPinRow>): Promise<void> {
    await this.ready();
    const clean = { ...patch } as Record<string, unknown>;
    delete clean.id;
    delete clean.projectId;
    delete clean.createdAt;
    await db().pinRows.update(id, clean as Partial<ToolboxPinRow>);
  }

  async removePinRow(id: string): Promise<void> {
    await this.ready();
    await db().pinRows.delete(id);
  }

  // ===== 调试记录（卍解项目）=====
  async listDebugNotes(projectId: string): Promise<ToolboxDebugNote[]> {
    await this.ready();
    const list = await db().debugNotes.where('projectId').equals(projectId).toArray();
    return list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async addDebugNote(projectId: string, input: { problem: string; solution?: string }): Promise<string> {
    await this.ready();
    const database = db();
    const existing = await database.debugNotes.where('projectId').equals(projectId).toArray();
    const id = newId('dbg');
    await database.debugNotes.add({
      id,
      projectId,
      problem: (input.problem || '').trim().slice(0, 300),
      solution: (input.solution || '').trim().slice(0, 600),
      sortOrder: existing.length,
      createdAt: nowIso(),
    });
    await database.projects.update(projectId, { updatedAt: nowIso() });
    return id;
  }

  async updateDebugNote(id: string, patch: Partial<ToolboxDebugNote>): Promise<void> {
    await this.ready();
    const clean = { ...patch } as Record<string, unknown>;
    delete clean.id;
    delete clean.projectId;
    delete clean.createdAt;
    await db().debugNotes.update(id, clean as Partial<ToolboxDebugNote>);
  }

  async removeDebugNote(id: string): Promise<void> {
    await this.ready();
    await db().debugNotes.delete(id);
  }

  async updateProject(id: string, patch: Partial<ToolboxProject>): Promise<void> {
    await this.ready();
    const clean = { ...patch } as Record<string, unknown>;
    delete clean.id;
    delete clean.createdAt;
    await db().projects.update(id, { ...clean, updatedAt: nowIso() } as Partial<ToolboxProject>);
  }

  async deleteProject(id: string): Promise<void> {
    await this.ready();
    const database = db();
    await database.transaction('rw', [database.projects, database.components, database.sections, database.images, database.codeFiles, database.pinRows, database.debugNotes], async () => {
      await database.components.where('projectId').equals(id).delete();
      await database.sections.where('projectId').equals(id).delete();
      await database.images.where('projectId').equals(id).delete();
      // 卍解的三类数据也要一起删：否则作品删掉了，代码正文还留在本机数据库里
      await database.codeFiles.where('projectId').equals(id).delete();
      await database.pinRows.where('projectId').equals(id).delete();
      await database.debugNotes.where('projectId').equals(id).delete();
      await database.projects.delete(id);
    });
    this.releaseImageUrls();
  }

  /** 「做同款」：复制出一个属于自己的副本（图片二进制直接复用，不重复占空间） */
  async duplicateProject(id: string, options?: { name?: string; source?: ProjectSource }): Promise<string> {
    const bundle = await this.getProject(id);
    if (!bundle) throw new Error('项目不存在');

    await this.ready();
    const database = db();
    const newProjectId = newId('prj');
    const ts = nowIso();

    // 副本的来源：收到的作品保持"收到"（留住作者信息）；示例/模板复制后就是自己的作品
    const origin = bundle.project.source;
    const copySource = origin?.type === 'shared'
      ? { type: 'shared' as const, ref: origin.ref ?? bundle.project.id, author: origin.author }
      : origin?.type === 'template'
        ? { type: 'template' as const, ref: origin.ref }
        : { type: 'manual' as const, ref: origin?.ref };

    await database.transaction('rw', [database.projects, database.components, database.sections, database.images, database.codeFiles, database.pinRows, database.debugNotes], async () => {
      await database.projects.add({
        ...bundle.project,
        id: newProjectId,
        name: options?.name ?? `${bundle.project.name}（我的副本）`,
        source: options?.source ?? copySource,
        views: 0,
        remixCount: 0,
        createdAt: ts,
        updatedAt: ts,
      });

      for (const c of bundle.components) {
        const rest: Partial<typeof c> = { ...c };
        delete rest.id;
        await database.components.add({ ...(rest as typeof c), id: newId('cmp'), projectId: newProjectId, createdAt: ts });
      }
      for (const s of bundle.sections) {
        const rest: Partial<typeof s> = { ...s };
        delete rest.id;
        await database.sections.add({ ...(rest as typeof s), id: newId('sec'), projectId: newProjectId });
      }
      for (const img of bundle.images) {
        const rest: Partial<typeof img> = { ...img };
        delete rest.id;
        await database.images.add({ ...(rest as typeof img), id: newId('img'), projectId: newProjectId, createdAt: ts });
      }
      // 「做同款」也把程序代码带上
      for (const code of bundle.codeFiles || []) {
        const rest: Partial<typeof code> = { ...code };
        delete rest.id;
        await database.codeFiles.add({ ...(rest as typeof code), id: newId('code'), projectId: newProjectId, createdAt: ts });
      }

      await database.projects.update(id, { remixCount: (bundle.project.remixCount || 0) + 1 });
    });

    return newProjectId;
  }

  /** 一次性导入完整作品：打开别人给的作品文件时用（保留原作者与时间） */
  async importBundle(bundle: ImportedBundle): Promise<string> {
    await this.ready();
    const database = db();
    const projectId = newId('prj');

    await database.transaction('rw', [database.projects, database.components, database.sections, database.images, database.codeFiles, database.pinRows, database.debugNotes], async () => {
      await database.projects.add({ ...bundle.project, id: projectId });

      for (const c of bundle.components) {
        await database.components.add({ ...c, id: newId('cmp'), projectId });
      }
      for (const s of bundle.sections) {
        await database.sections.add({ ...s, id: newId('sec'), projectId });
      }
      for (const img of bundle.images) {
        await database.images.add({ ...img, id: newId('img'), projectId });
      }
      // 卍解作品带过来的程序代码
      for (const code of bundle.codeFiles || []) {
        await database.codeFiles.add({ ...code, id: newId('code'), projectId });
      }
      // 接线表与调试记录
      for (const row of bundle.pinRows || []) {
        await database.pinRows.add({ ...row, id: newId('pin'), projectId });
      }
      for (const note of bundle.debugNotes || []) {
        await database.debugNotes.add({ ...note, id: newId('dbg'), projectId });
      }
    });

    return projectId;
  }

  // ===== 元器件（手动添加 / AI 识别结果同一入口）=====
  async addComponent(projectId: string, input: ComponentInput): Promise<string> {
    await this.ready();
    const database = db();
    const existing = await database.components.where('projectId').equals(projectId).toArray();
    const id = newId('cmp');
    await database.components.add({
      id,
      projectId,
      name: input.name.trim() || '未命名元件',
      type: input.type ?? '',
      model: input.model ?? '',
      manufacturer: input.manufacturer ?? '',
      packageType: input.packageType ?? '',
      pinCount: input.pinCount ?? 0,
      specifications: input.specifications ?? '',
      description: input.description ?? '',
      annotation: input.annotation ?? '',
      quantity: input.quantity && input.quantity > 0 ? input.quantity : 1,
      checked: false,
      confidence: input.confidence ?? 0,
      sortOrder: existing.length,
      createdAt: nowIso(),
      // 来自元件库的那一行：记下编号，导出作品时会带上这个元件的快照
      ...(input.libraryId ? { libraryId: input.libraryId } : {}),
    });
    await database.projects.update(projectId, { updatedAt: nowIso() });
    return id;
  }

  async updateComponent(id: string, patch: Partial<ToolboxComponent>): Promise<void> {
    await this.ready();
    const clean = { ...patch } as Record<string, unknown>;
    delete clean.id;
    delete clean.projectId;
    delete clean.createdAt;
    const database = db();
    await database.components.update(id, clean as Partial<ToolboxComponent>);
    const comp = await database.components.get(id);
    if (comp) await database.projects.update(comp.projectId, { updatedAt: nowIso() });
  }

  async removeComponent(id: string): Promise<void> {
    await this.ready();
    const database = db();
    const comp = await database.components.get(id);
    await database.components.delete(id);
    if (comp) await database.projects.update(comp.projectId, { updatedAt: nowIso() });
  }

  // ===== 教程小节 =====
  async addSection(projectId: string, input: { type?: 'step' | 'note'; title: string; content?: string }): Promise<string> {
    await this.ready();
    const database = db();
    const existing = await database.sections.where('projectId').equals(projectId).toArray();
    const id = newId('sec');
    await database.sections.add({
      id,
      projectId,
      type: input.type ?? 'step',
      title: input.title.trim() || '未命名小节',
      content: input.content ?? '',
      sortOrder: existing.length,
    });
    await database.projects.update(projectId, { updatedAt: nowIso() });
    return id;
  }

  async updateSection(id: string, patch: Partial<ToolboxSection>): Promise<void> {
    await this.ready();
    const clean = { ...patch } as Record<string, unknown>;
    delete clean.id;
    delete clean.projectId;
    await db().sections.update(id, clean as Partial<ToolboxSection>);
  }

  async removeSection(id: string): Promise<void> {
    await this.ready();
    await db().sections.delete(id);
  }

  // ===== 图片（二进制存本地）=====
  async addImage(projectId: string, file: Blob, kind: ImageKind, description = ''): Promise<string> {
    await this.ready();
    const database = db();
    // 手机拍的照片动辄几 MB：先等比压缩再存，省空间也让作品文件发得出去
    const packed = await compressImage(file);
    const id = newId('img');
    await database.images.add({
      id,
      projectId,
      kind,
      description,
      mime: packed.blob.type || 'image/jpeg',
      size: packed.blob.size,
      blob: packed.blob,
      createdAt: nowIso(),
    });
    await database.projects.update(projectId, { updatedAt: nowIso() });
    return id;
  }

  async removeImage(id: string): Promise<void> {
    await this.ready();
    const url = this.urlCache.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      this.urlCache.delete(id);
    }
    await db().images.delete(id);
  }

  async imageUrl(imageId: string | null | undefined): Promise<string | null> {
    if (!imageId) return null;
    const cached = this.urlCache.get(imageId);
    if (cached) return cached;
    await this.ready();
    const row = await db().images.get(imageId);
    if (!row) return null;
    const url = URL.createObjectURL(row.blob);
    this.urlCache.set(imageId, url);
    return url;
  }

  releaseImageUrls(): void {
    for (const url of this.urlCache.values()) URL.revokeObjectURL(url);
    this.urlCache.clear();
    for (const url of this.libraryUrlCache.values()) URL.revokeObjectURL(url);
    this.libraryUrlCache.clear();
  }

  // ===== 统计 =====
  async stats(projectId: string): Promise<LocalStats> {
    await this.ready();
    const database = db();
    const [components, images] = await Promise.all([
      database.components.where('projectId').equals(projectId).toArray(),
      database.images.where('projectId').equals(projectId).toArray(),
    ]);

    const confidences = components.map((c) => c.confidence || 0).filter((c) => c > 0);
    const avgConfidence = confidences.length
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;
    const componentTypes = [...new Set(components.map((c) => c.type).filter(Boolean))];
    const hasPhoto = images.some((i) => i.kind === 'photo' || i.kind === 'wiring');
    const hasDrawing = images.some((i) => i.kind === 'schematic' || i.kind === 'circuit');

    return {
      componentCount: components.length,
      imageCount: images.length,
      fileSizeBytes: images.reduce((sum, i) => sum + (i.size || 0), 0),
      projectType: hasPhoto ? '实物项目' : hasDrawing ? '设计项目' : '方案项目',
      avgConfidence,
      scenarioTags: deriveScenarioTags(componentTypes),
      componentTypes: componentTypes.slice(0, 6),
      checkedCount: components.filter((c) => c.checked).length,
    };
  }

  // ===== 模板（离线自带）=====
  async listTemplates(): Promise<ToolboxTemplate[]> {
    await this.ready();
    const list = await db().templates.toArray();
    return list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async instantiateTemplate(templateId: string, options?: { name?: string }): Promise<string> {
    await this.ready();
    const database = db();
    const tpl = await database.templates.get(templateId);
    if (!tpl) throw new Error('模板不存在');

    const projectId = await this.createProject({
      name: options?.name ?? tpl.name,
      notes: tpl.description,
      source: { type: 'template', ref: tpl.id },
    });

    for (const c of tpl.components) {
      const { sortOrder, ...rest } = c;
      const componentId = await this.addComponent(projectId, rest);
      await database.components.update(componentId, { sortOrder });
    }
    for (const s of tpl.sections) {
      const { sortOrder, ...rest } = s;
      const sectionId = await this.addSection(projectId, rest);
      await database.sections.update(sectionId, { sortOrder });
    }

    return projectId;
  }

  // ===== 元件库 =====
  // 内置库（打包在软件里，只读）+ 用户库（本机 IndexedDB），查询时合并，同 id 以用户库为准。

  async listLibrary(): Promise<LibraryComponent[]> {
    await this.ready();
    const merged = new Map<string, LibraryComponent>();
    for (const item of BUILTIN_LIBRARY) merged.set(item.id, item);

    const rows = await db().library.toArray();
    for (const row of rows) {
      let url = this.libraryUrlCache.get(row.id);
      if (!url && row.image) {
        url = URL.createObjectURL(row.image);
        this.libraryUrlCache.set(row.id, url);
      }
      merged.set(row.id, { ...row, imageUrl: url });
    }
    return [...merged.values()];
  }

  async getLibraryComponent(id: string): Promise<LibraryComponent | null> {
    const all = await this.listLibrary();
    return all.find((c) => c.id === id) ?? null;
  }

  async saveLibraryComponent(input: LibraryComponentInput): Promise<string> {
    await this.ready();
    const id = (input.id || '').trim() || newId('lib_');
    if (BUILTIN_LIBRARY_IDS.has(id)) {
      throw new Error('这个编号和内置元件重了，换个名字吧');
    }
    const previous = await db().library.get(id);
    const { image, ...rest } = input;
    const row: StoredLibraryComponent = {
      ...rest,
      id,
      createdAt: input.createdAt || previous?.createdAt || nowIso(),
      // image 传 undefined 表示"不改图片"；传 null 表示清掉
      image: image === undefined ? previous?.image ?? null : image,
    };
    await db().library.put(row);

    const cached = this.libraryUrlCache.get(id);
    if (cached) {
      URL.revokeObjectURL(cached);
      this.libraryUrlCache.delete(id);
    }
    return id;
  }

  async removeLibraryComponent(id: string): Promise<void> {
    await this.ready();
    if (BUILTIN_LIBRARY_IDS.has(id)) return; // 内置的删不掉
    const cached = this.libraryUrlCache.get(id);
    if (cached) {
      URL.revokeObjectURL(cached);
      this.libraryUrlCache.delete(id);
    }
    await db().library.delete(id);
  }

  /** 从作品里带进来的元件：同 id 跳过（保留本地版本），同名不同 id 都保留 */
  async importLibraryComponents(
    items: LibraryComponentInput[],
    fromProject?: string
  ): Promise<{ added: LibraryComponent[]; skipped: LibraryComponent[] }> {
    await this.ready();
    const added: LibraryComponent[] = [];
    const skipped: LibraryComponent[] = [];
    const existing = new Map((await db().library.toArray()).map((r) => [r.id, r]));

    for (const item of items) {
      const id = (item.id || '').trim();
      if (!id || BUILTIN_LIBRARY_IDS.has(id) || existing.has(id)) {
        skipped.push({ ...item, id, source: item.source || 'imported' });
        continue;
      }
      await this.saveLibraryComponent({ ...item, id, source: 'imported', fromProject });
      const saved = await this.getLibraryComponent(id);
      if (saved) added.push(saved);
      existing.set(id, { ...item, id } as StoredLibraryComponent);
    }
    return { added, skipped };
  }

  async libraryImageUrl(id: string): Promise<string | null> {
    await this.ready();
    const row = await db().library.get(id);
    if (!row?.image) return null;
    const cached = this.libraryUrlCache.get(id);
    if (cached) return cached;
    const url = URL.createObjectURL(row.image);
    this.libraryUrlCache.set(id, url);
    return url;
  }

  // ===== 设置（AI Key 等，只存本机）=====
  async getSetting(key: string): Promise<string | null> {
    await this.ready();
    const row = await db().settings.get(key);
    return row ? row.value : null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.ready();
    await db().settings.put({ key, value, updatedAt: nowIso() });
  }

  async deleteSetting(key: string): Promise<void> {
    await this.ready();
    await db().settings.delete(key);
  }

  async estimateUsage(): Promise<number> {
    await this.ready();
    const images = await db().images.toArray();
    const imageBytes = images.reduce((sum, i) => sum + (i.size || 0), 0);
    return imageBytes;
  }
}

export const localStore: ToolboxStore = new LocalToolboxStore();
