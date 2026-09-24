import { existsSync, statSync } from 'fs';
import path from 'path';
import { deriveScenarioTags } from './scenarioTags';

// 项目详情/分享页共用的派生数据计算：避免两个接口各写一份
// 注意：本文件含 Node 依赖（fs），只能在服务端使用；浏览器侧请用 ./scenarioTags

export { deriveScenarioTags };

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export interface ProjectStats {
  views: number;
  stars: number;
  starred: number;
  clones: number;
  fileSizeBytes: number;
  projectType: string;
  avgConfidence: number;
  scenarioTags: string[];
  componentTypes: string[];
}

interface ComponentLike {
  image_path?: string;
  component_type?: string;
  confidence?: number;
}

interface ImageLike {
  image_path?: string;
  kind?: string;
}

interface ProjectLike {
  share_count?: number;
  views?: number;
}

// 统计项目相关图片占用的磁盘空间（「文件大小」信息项）
export function filesSize(paths: Array<string | null | undefined>): number {
  let total = 0;
  for (const p of paths) {
    if (!p) continue;
    const base = path.basename(String(p));
    if (!base) continue;
    try {
      const full = path.join(UPLOAD_DIR, base);
      if (existsSync(full)) total += statSync(full).size;
    } catch {
      // 文件缺失时跳过
    }
  }
  return total;
}

export function buildStats(
  project: ProjectLike,
  components: ComponentLike[],
  images: ImageLike[],
  stars: number,
  starred: number
): ProjectStats {
  const confidences = components.map((c) => Number(c.confidence) || 0).filter((c) => c > 0);
  const avgConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  const kinds = new Set(images.map((i) => i.kind || 'photo'));
  const hasPhoto = kinds.has('photo') || kinds.has('wiring') || components.some((c) => c.image_path);
  const hasSchematic = kinds.has('schematic') || kinds.has('circuit');
  const projectType = hasPhoto ? '实物项目' : hasSchematic ? '设计项目' : '方案项目';

  const componentTypes = [...new Set(components.map((c) => c.component_type).filter(Boolean))] as string[];
  const scenarioTags = deriveScenarioTags(componentTypes);

  return {
    views: project.views || 0,
    stars,
    starred,
    clones: project.share_count || 0,
    fileSizeBytes: filesSize([
      ...components.map((c) => c.image_path),
      ...images.map((i) => i.image_path),
    ]),
    projectType,
    avgConfidence,
    scenarioTags: scenarioTags.slice(0, 3),
    componentTypes: componentTypes.slice(0, 6),
  };
}

// 「主要功能」列表：优先用项目自己填写的，没有则回退到教程小节标题
export function resolveFeatures(
  storedFeatures: string | null | undefined,
  sections: Array<{ type?: string; title?: string }>
): { features: string; derived: boolean } {
  const stored = (storedFeatures || '').trim();
  if (stored) return { features: stored, derived: false };

  const titles = sections
    .filter((s) => (s.type || 'step') === 'step' && s.title)
    .map((s) => String(s.title).trim())
    .filter(Boolean);

  return { features: titles.join('\n'), derived: titles.length > 0 };
}
