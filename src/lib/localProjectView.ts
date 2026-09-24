// 本地工具箱数据 → 「项目详情页」所需的结构
// 目的：让同一个详情页组件既能读服务器数据，也能读本机数据（界面完全一致）

import { getStore, type ComponentInput, type ImageKind } from '@/lib/store';

export interface LocalViewProject {
  id: string;
  name: string;
  notes: string;
  description: string;
  features: string;
  is_shared: number;
  share_token: string | null;
  share_count: number;
  views: number;
  created_at: string;
  updated_at: string;
  author_name: string;
  source_type: string;
}

export interface LocalViewComponent {
  id: string;
  image_path: string;
  component_name: string;
  component_type: string;
  description: string;
  confidence: number;
  annotation: string;
  quantity: number;
  model: string;
  manufacturer: string;
  package_type: string;
  pin_count: number;
  specifications: string;
  sort_order: number;
  checked: number;
}

export interface LocalViewImage {
  id: string;
  image_path: string;
  description: string;
  kind: string;
  created_at: string;
}

export interface LocalViewSection {
  id: string;
  type: string;
  title: string;
  content: string;
  sort_order: number;
}

export interface LocalViewPayload {
  project: LocalViewProject;
  components: LocalViewComponent[];
  sections: LocalViewSection[];
  images: LocalViewImage[];
  stats: {
    views: number;
    stars: number;
    starred: number;
    clones: number;
    fileSizeBytes: number;
    projectType: string;
    avgConfidence: number;
    scenarioTags: string[];
    componentTypes: string[];
  };
  isOwner: boolean;
  featuresDerived: boolean;
}

/** 读一件本机作品，并把它转成详情页需要的结构（图片解析成可直接显示的地址） */
export async function loadLocalProjectView(projectId: string): Promise<LocalViewPayload | null> {
  const store = getStore();
  const bundle = await store.getProject(projectId);
  if (!bundle) return null;

  const [stats, imageUrls] = await Promise.all([
    store.stats(projectId),
    Promise.all(bundle.images.map((img) => store.imageUrl(img.id))),
  ]);

  const steps = bundle.sections.filter((s) => s.type === 'step');

  return {
    project: {
      id: bundle.project.id,
      name: bundle.project.name,
      notes: bundle.project.notes,
      description: bundle.project.description,
      features: bundle.project.features,
      is_shared: 0,
      share_token: null,
      share_count: 0,
      views: bundle.project.views || 0,
      created_at: bundle.project.createdAt,
      updated_at: bundle.project.updatedAt,
      author_name: bundle.project.source?.author || '本机作品',
      source_type: bundle.project.source?.type ?? 'manual',
    },
    components: bundle.components.map((c) => ({
      id: c.id,
      image_path: '',
      component_name: c.name,
      component_type: c.type,
      description: c.description,
      confidence: c.confidence,
      annotation: c.annotation,
      quantity: c.quantity,
      model: c.model,
      manufacturer: c.manufacturer,
      package_type: c.packageType,
      pin_count: c.pinCount,
      specifications: c.specifications,
      sort_order: c.sortOrder,
      checked: c.checked ? 1 : 0,
    })),
    sections: bundle.sections.map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      content: s.content,
      sort_order: s.sortOrder,
    })),
    images: bundle.images.map((img, index) => ({
      id: img.id,
      image_path: imageUrls[index] || '',
      description: img.description,
      kind: img.kind,
      created_at: img.createdAt,
    })),
    stats: {
      views: bundle.project.views || 0,
      stars: 0,
      starred: 0,
      clones: bundle.project.remixCount || 0,
      fileSizeBytes: stats.fileSizeBytes,
      projectType: stats.projectType,
      avgConfidence: stats.avgConfidence,
      scenarioTags: stats.scenarioTags,
      componentTypes: stats.componentTypes,
    },
    isOwner: true,
    featuresDerived: !bundle.project.features && steps.length > 0,
  };
}

export async function localUpdateProject(
  projectId: string,
  patch: { name?: string; notes?: string; description?: string; features?: string }
): Promise<void> {
  await getStore().updateProject(projectId, patch);
}

export async function localDeleteProject(projectId: string): Promise<void> {
  await getStore().deleteProject(projectId);
}

export async function localAddComponent(projectId: string, input: ComponentInput): Promise<void> {
  await getStore().addComponent(projectId, input);
}

export async function localUpdateComponent(
  id: string,
  patch: {
    component_name?: string; component_type?: string; description?: string;
    model?: string; manufacturer?: string; package_type?: string;
    pin_count?: number; specifications?: string; annotation?: string;
    quantity?: number; checked?: number;
  }
): Promise<void> {
  await getStore().updateComponent(id, {
    ...(patch.component_name !== undefined ? { name: patch.component_name } : {}),
    ...(patch.component_type !== undefined ? { type: patch.component_type } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.model !== undefined ? { model: patch.model } : {}),
    ...(patch.manufacturer !== undefined ? { manufacturer: patch.manufacturer } : {}),
    ...(patch.package_type !== undefined ? { packageType: patch.package_type } : {}),
    ...(patch.pin_count !== undefined ? { pinCount: patch.pin_count } : {}),
    ...(patch.specifications !== undefined ? { specifications: patch.specifications } : {}),
    ...(patch.annotation !== undefined ? { annotation: patch.annotation } : {}),
    ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
    ...(patch.checked !== undefined ? { checked: patch.checked === 1 } : {}),
  });
}

export async function localRemoveComponent(id: string): Promise<void> {
  await getStore().removeComponent(id);
}

export async function localAddImage(projectId: string, file: Blob, kind: ImageKind, description = ''): Promise<void> {
  await getStore().addImage(projectId, file, kind, description);
}

export async function localRemoveImage(id: string): Promise<void> {
  await getStore().removeImage(id);
}
