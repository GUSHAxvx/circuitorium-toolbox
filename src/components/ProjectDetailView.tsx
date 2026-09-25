'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import QRCodeBox from '@/components/QRCodeBox';
import LibraryPicker from '@/components/LibraryPicker';
import ProjectCodePanel from '@/components/ProjectCodePanel';
import { DIFFICULTY_LABEL, type ProjectDifficulty } from '@/lib/store/types';
import { getToken, authHeaders, copyText } from '@/lib/client';
import { bgGradient, gridBg } from '@/styles/theme';
import {
  loadLocalProjectView, localAddComponent, localAddImage, localDeleteProject,
  localRemoveComponent, localRemoveImage, localUpdateComponent, localUpdateProject,
} from '@/lib/localProjectView';

interface Project {
  id: number | string;
  name: string;
  notes: string;
  description?: string;
  /** 主要功能，每行一条 */
  features?: string;
  is_shared: number;
  share_token: string | null;
  share_count: number;
  views: number;
  created_at: string;
  updated_at: string;
  author_name?: string;
  /** 本地模式：作品来源 manual / template / shared / sample */
  source_type?: string;
  /** 本地模式：难度 始解 / 卍解（服务器数据没有这个字段） */
  difficulty?: ProjectDifficulty;
  /** 卍解项目的开发环境说明 */
  code_note?: string;
}

interface ProjectComponent {
  id: number | string;
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

interface ProjectImage {
  id: number | string;
  image_path: string;
  description: string;
  kind?: string;
  created_at: string;
}

interface ProjectSection {
  id: number | string;
  type: string;
  title: string;
  content: string;
  sort_order: number;
}

interface ProjectStats {
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

interface RecItem {
  id: number | string;
  name: string;
  share_token: string;
  author_name: string;
  cover_path: string | null;
  type_tags: string | null;
  views: number;
  stars: number;
  starred: number;
}

const KIND_LABELS: Record<string, string> = {
  schematic: '原理图',
  circuit: '电路图',
  wiring: '接线图',
  photo: '实物图',
};

// 预览标签页：项目预览 / 电路图 / 原理图 / 实物图 / 3D 视图
const TABS = [
  { key: 'preview', label: '项目预览' },
  { key: 'circuit', label: '电路图' },
  { key: 'schematic', label: '原理图' },
  { key: 'photo', label: '实物图' },
  { key: '3d', label: '3D 视图' },
];

const BOM_PREVIEW_ROWS = 5;

// ===== 工具函数 =====
const imgUrl = (p?: string | null) => (p ? p.replace('/uploads/', '/api/uploads/') : '');

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return value.slice(0, 16);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n ?? 0);
}

const splitTags = (v?: string | null) => (v ? v.split('|').filter(Boolean) : []);

// ===== 图标（内联 SVG，避免额外依赖） =====
const ICONS: Record<string, React.ReactNode> = {
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="8" r="0.6" fill="currentColor" /></>),
  doc: (<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>),
  box: (<><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" /><path d="M3.3 7 12 12l8.7-5" /><path d="M12 22V12" /></>),
  image: (<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m21 16-5-5L5 21" /></>),
  star: (<path d="m12 3.5 2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.84L6.6 20.15l1.03-6L3.3 9.9l6-.9z" />),
  eye: (<><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></>),
  heart: (<path d="M12 20s-7-4.4-7-9.4A4 4 0 0 1 12 8a4 4 0 0 1 7 2.6c0 5-7 9.4-7 9.4z" />),
  download: (<><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></>),
  share: (<><circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" /><path d="m8.3 10.8 7.4-4.3M8.3 13.2l7.4 4.3" /></>),
  more: (<><circle cx="5" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="19" cy="12" r="1.4" fill="currentColor" /></>),
  check: (<path d="m5 13 4 4L19 7" />),
  zoomIn: (<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M11 8v6" /><path d="M8 11h6" /></>),
  zoomOut: (<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M8 11h6" /></>),
  expand: (<><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></>),
  fit: (<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /></>),
  close: (<><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>),
  chip: (<><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" /></>),
  cube: (<><path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></>),
  link: (<><path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  trash: (<><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" /></>),
};

function Icon({ name, size = 16, color = '#4f7cff' }: { name: string; size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

// 卡片外壳（标题 + 右上角操作区）
function Card({
  title,
  icon,
  extra,
  children,
  style,
  bodyStyle,
}: {
  title?: string;
  icon?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}) {
  return (
    <section className="pj-card" style={style}>
      {(title || extra) && (
        <header className="pj-card-head" style={{ justifyContent: title ? 'space-between' : 'flex-start' }}>
          {title && (
            <span className="pj-card-title">
              {icon && <Icon name={icon} size={15} />}
              {title}
            </span>
          )}
          {extra}
        </header>
      )}
      <div style={bodyStyle}>{children}</div>
    </section>
  );
}

interface ProjectDetailViewProps {
  /** 项目页用法：/projects/[id] */
  projectId?: string;
  /** 分享页用法：/share-project/[token]（无需登录，只读 + 导入） */
  shareToken?: string;
  /** server = 服务器数据；local = 本机工具箱数据（界面完全一致） */
  mode?: 'server' | 'local';
  /** 本地模式：返回工具箱 */
  onBack?: () => void;
  /** 本地模式：额外的头部按钮（分享作品 / 保存作品文件 等） */
  extraActions?: React.ReactNode;
}

export default function ProjectDetailView({
  projectId, shareToken, mode = 'server', onBack, extraActions,
}: ProjectDetailViewProps) {
  const router = useRouter();
  const isLocal = mode === 'local';
  /** 卍解项目：要写代码，项目里多一块「程序代码」 */
  const [difficulty, setDifficulty] = useState<ProjectDifficulty>('shikai');
  const isBankai = isLocal && difficulty === 'bankai';
  const isShareView = !!shareToken;
  const endpoint = isShareView
    ? `/api/share-project?token=${encodeURIComponent(String(shareToken))}`
    : `/api/projects/${projectId}`;

  const [project, setProject] = useState<Project | null>(null);
  const [components, setComponents] = useState<ProjectComponent[]>([]);
  const [sections, setSections] = useState<ProjectSection[]>([]);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [recs, setRecs] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

  // 预览
  const [tab, setTab] = useState('preview');
  const [zoom, setZoom] = useState(100);
  const [viewer, setViewer] = useState<{ src: string; alt: string } | null>(null);

  // 编辑
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editingComponent, setEditingComponent] = useState<number | string | null>(null);
  const [editForm, setEditForm] = useState({
    component_name: '', component_type: '', description: '',
    model: '', manufacturer: '', package_type: '', pin_count: 0, specifications: '',
  });
  const [editingAnnotation, setEditingAnnotation] = useState<number | string | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  // 本地模式：手动添加元件
  const [addingComponent, setAddingComponent] = useState(false);
  const [newComp, setNewComp] = useState<{ name: string; type: string; model: string; quantity: number; libraryId?: string }>(
    { name: '', type: '', model: '', quantity: 1 }
  );
  const [pickingFromLibrary, setPickingFromLibrary] = useState(false);
  const [saving, setSaving] = useState(false);

  // 交互
  const [showAllBom, setShowAllBom] = useState(false);
  const [showAllImages, setShowAllImages] = useState(false);
  const [imageFilter, setImageFilter] = useState('all');
  const [uploadKind, setUploadKind] = useState('photo');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState('');
  const [cloning, setCloning] = useState(false);
  const [featuresDerived, setFeaturesDerived] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editFeatures, setEditFeatures] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProject = useCallback(async () => {
    // 本地模式：直接读本机数据，不联网、不需要登录
    if (isLocal) {
      try {
        const data = await loadLocalProjectView(String(projectId));
        if (!data) {
          setToast('这件作品不在这台电脑上了（可能已经删掉了）');
        } else {
          setProject(data.project);
          setComponents(data.components);
          setSections(data.sections);
          setImages(data.images);
          setStats(data.stats);
          setIsOwner(true);
          setFeaturesDerived(data.featuresDerived);
          setDifficulty(data.project.difficulty === 'bankai' ? 'bankai' : 'shikai');
        }
      } catch (e) {
        setToast(e instanceof Error ? e.message : '这台电脑的本地存储打不开');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 分享页无需登录；项目页需要登录后按权限查看
    if (!isShareView && !getToken()) {
      setToast('请先登录后查看项目');
      setNeedLogin(true);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(endpoint, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        setProject(data.project);
        setComponents(data.components || []);
        setSections(data.sections || []);
        setImages(data.images || []);
        setStats(data.stats || null);
        setIsOwner(!!data.isOwner);
        setFeaturesDerived(!!data.featuresDerived);
      } else {
        setToast(data.error || '加载失败');
      }
    } catch {
      setToast('网络错误，加载失败');
    } finally {
      setLoading(false);
    }
  }, [endpoint, isShareView, isLocal, projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // 相关项目推荐（来自社区广场）——本地工具箱里没有社区，跳过
  useEffect(() => {
    if (isLocal) return;
    fetch('/api/community', { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) {
          setRecs(data.projects.filter((p: RecItem) => String(p.id) !== String(projectId)).slice(0, 3));
        }
      })
      .catch(() => undefined);
  }, [projectId, isLocal]);

  // Esc 关闭弹层
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setViewer(null);
      setShareOpen(false);
      setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2600);
  };

  // ===== 项目管理（仅本人） =====
  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    if (isLocal) {
      await localUpdateProject(String(projectId), { name: editName });
      setProject((p) => (p ? { ...p, name: editName } : p));
      setEditingName(false);
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT', headers: authHeaders(true), body: JSON.stringify({ name: editName }),
    });
    if (res.ok) setProject((p) => (p ? { ...p, name: editName } : p));
    setEditingName(false);
    setSaving(false);
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    if (isLocal) {
      await localUpdateProject(String(projectId), { notes: editNotes });
      setProject((p) => (p ? { ...p, notes: editNotes } : p));
      setEditingNotes(false);
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT', headers: authHeaders(true), body: JSON.stringify({ notes: editNotes }),
    });
    if (res.ok) setProject((p) => (p ? { ...p, notes: editNotes } : p));
    setEditingNotes(false);
    setSaving(false);
  };

  // 「项目描述」+「主要功能」自主编辑
  const handleSaveDescription = async () => {
    setSaving(true);
    if (isLocal) {
      await localUpdateProject(String(projectId), { description: editDesc, features: editFeatures });
      setProject((p) => (p ? { ...p, description: editDesc, features: editFeatures } : p));
      setFeaturesDerived(false);
      setEditingDesc(false);
      flash('项目描述存好了');
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({ description: editDesc, features: editFeatures }),
    });
    if (res.ok) {
      setProject((p) => (p ? { ...p, description: editDesc, features: editFeatures } : p));
      setFeaturesDerived(false);
      setEditingDesc(false);
      flash('项目描述存好了');
    } else {
      const data = await res.json().catch(() => ({}));
      flash(data.error || '保存失败');
    }
    setSaving(false);
  };

  const handleDeleteProject = async () => {
    if (!confirm('删掉这件作品？里面的元件和图片会一起走，删了就找不回来了。')) return;
    if (isLocal) {
      await localDeleteProject(String(projectId));
      onBack?.();
      return;
    }
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) router.push('/projects');
  };

  const handleToggleChecked = async (componentId: number | string, checked: boolean) => {
    setComponents((prev) => prev.map((c) => (c.id === componentId ? { ...c, checked: checked ? 1 : 0 } : c)));
    if (isLocal) {
      await localUpdateComponent(String(componentId), { checked: checked ? 1 : 0 });
      return;
    }
    await fetch(`/api/projects/${projectId}/components/${componentId}`, {
      method: 'PUT', headers: authHeaders(true), body: JSON.stringify({ checked }),
    });
  };

  const handleQuantityChange = async (componentId: number | string, delta: number) => {
    const comp = components.find((c) => c.id === componentId);
    if (!comp) return;
    const newQty = Math.max(1, (comp.quantity || 1) + delta);
    if (newQty === (comp.quantity || 1)) return;
    setComponents((prev) => prev.map((c) => (c.id === componentId ? { ...c, quantity: newQty } : c)));
    if (isLocal) {
      await localUpdateComponent(String(componentId), { quantity: newQty });
      return;
    }
    await fetch(`/api/projects/${projectId}/components/${componentId}`, {
      method: 'PUT', headers: authHeaders(true), body: JSON.stringify({ quantity: newQty }),
    });
  };

  const handleRemoveComponent = async (componentId: number | string) => {
    if (!confirm('把这个元件从作品里拿掉？')) return;
    if (isLocal) {
      await localRemoveComponent(String(componentId));
      setComponents((prev) => prev.filter((c) => c.id !== componentId));
      setEditingComponent(null);
      return;
    }
    const res = await fetch(`/api/projects/${projectId}/components/${componentId}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    if (res.ok) {
      setComponents((prev) => prev.filter((c) => c.id !== componentId));
      setEditingComponent(null);
    }
  };

  /** 本地模式：手动添加一个元件（没配 AI 也能用） */
  const handleAddComponent = async () => {
    if (!newComp.name.trim()) {
      flash('先写一下元件的名字');
      return;
    }
    setSaving(true);
    await localAddComponent(String(projectId), {
      name: newComp.name.trim(),
      type: newComp.type.trim(),
      model: newComp.model.trim(),
      quantity: Math.max(1, newComp.quantity || 1),
      // 从元件库挑的：记下编号，导出作品时会带上这个元件的快照
      ...(newComp.libraryId ? { libraryId: newComp.libraryId } : {}),
    });
    await loadProject();
    setNewComp({ name: '', type: '', model: '', quantity: 1 });
    setAddingComponent(false);
    setSaving(false);
    flash('元件已加入作品');
  };

  const handleStartEdit = (comp: ProjectComponent) => {
    setEditForm({
      component_name: comp.component_name,
      component_type: comp.component_type,
      description: comp.description,
      model: comp.model || '',
      manufacturer: comp.manufacturer || '',
      package_type: comp.package_type || '',
      pin_count: comp.pin_count || 0,
      specifications: comp.specifications || '',
    });
    setEditingComponent(comp.id);
  };

  const handleSaveComponent = async () => {
    if (!editingComponent) return;
    setSaving(true);
    if (isLocal) {
      await localUpdateComponent(String(editingComponent), editForm);
      setComponents((prev) => prev.map((c) => (c.id === editingComponent ? { ...c, ...editForm } : c)));
      flash('元件信息存好了');
      setEditingComponent(null);
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/projects/${projectId}/components/${editingComponent}`, {
      method: 'PUT', headers: authHeaders(true), body: JSON.stringify(editForm),
    });
    if (res.ok) {
      setComponents((prev) => prev.map((c) => (c.id === editingComponent ? { ...c, ...editForm } : c)));
      flash('元器件信息存好了');
    }
    setEditingComponent(null);
    setSaving(false);
  };

  const handleSaveAnnotation = async (componentId: number | string) => {
    setSaving(true);
    if (isLocal) {
      await localUpdateComponent(String(componentId), { annotation: annotationText });
      setComponents((prev) => prev.map((c) => (c.id === componentId ? { ...c, annotation: annotationText } : c)));
      setEditingAnnotation(null);
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/projects/${projectId}/components/${componentId}`, {
      method: 'PUT', headers: authHeaders(true), body: JSON.stringify({ annotation: annotationText }),
    });
    if (res.ok) {
      setComponents((prev) => prev.map((c) => (c.id === componentId ? { ...c, annotation: annotationText } : c)));
    }
    setEditingAnnotation(null);
    setSaving(false);
  };

  // ===== 分享 / 克隆 / 收藏 =====
  const handleShareProject = async () => {
    setSharing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        setProject((p) => (p ? { ...p, is_shared: 1, share_token: data.share_token } : p));
        const url = window.location.origin + data.share_url;
        const copied = await copyText(url);
        flash(copied ? '分享成功，链接已复制到剪贴板' : '分享成功');
      } else {
        flash(data.error || '分享失败');
      }
    } catch {
      flash('网络错误，请重试');
    } finally {
      setSharing(false);
    }
  };

  const handleUnshareProject = async () => {
    setSharing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) {
        setProject((p) => (p ? { ...p, is_shared: 0 } : p));
        flash('已取消分享');
      }
    } finally {
      setSharing(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!project?.share_token) return;
    const url = `${window.location.origin}/share-project/${project.share_token}`;
    const copied = await copyText(url);
    flash(copied ? '分享链接已复制到剪贴板' : `链接：${url}`);
    setMenuOpen(false);
  };

  const handleClone = async () => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (!project?.share_token) {
      flash('该项目还没有公开分享，暂时无法导入');
      return;
    }
    setCloning(true);
    try {
      const res = await fetch('/api/share-project/clone', {
        method: 'POST', headers: authHeaders(true), body: JSON.stringify({ token: project.share_token }),
      });
      const data = await res.json();
      if (res.ok && data.project) {
        router.push(`/projects/${data.project.id}`);
      } else {
        flash(data.error || '导入失败');
      }
    } catch {
      flash('网络错误，请重试');
    } finally {
      setCloning(false);
    }
  };

  const toggleStar = async (id: number | string, isCurrent: boolean) => {
    const res = await fetch(`/api/projects/${id}/star`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    if (isCurrent) {
      setStats((s) => (s ? { ...s, starred: data.starred, stars: data.stars } : s));
    } else {
      setRecs((prev) => prev.map((p) => (p.id === id ? { ...p, starred: data.starred, stars: data.stars } : p)));
    }
  };

  // ===== 图片 =====
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    if (isLocal) {
      try {
        await localAddImage(String(projectId), file, uploadKind as 'schematic' | 'circuit' | 'wiring' | 'photo');
        await loadProject();
        flash(`${KIND_LABELS[uploadKind] || '图片'}已保存到本机`);
      } catch (err) {
        flash(err instanceof Error ? err.message : '保存失败');
      } finally {
        setUploadingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      return;
    }
    const formData = new FormData();
    formData.append('image', file);
    formData.append('kind', uploadKind);
    try {
      const res = await fetch(`/api/projects/${projectId}/images`, {
        method: 'POST', headers: authHeaders(), body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setImages((prev) => [data.image, ...prev]);
        flash(`${KIND_LABELS[uploadKind] || '图片'}已上传`);
      } else {
        const data = await res.json();
        flash(data.error || '上传失败');
      }
    } catch {
      flash('网络错误，上传失败');
    }
    setUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteImage = async (imageId: number | string) => {
    if (!confirm('删掉这张图片？')) return;
    if (isLocal) {
      await localRemoveImage(String(imageId));
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      return;
    }
    const res = await fetch(`/api/projects/${projectId}/images/${imageId}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    if (res.ok) setImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  // ===== 派生数据 =====
  const steps = sections.filter((s) => s.type === 'step');
  const notesSecs = sections.filter((s) => s.type === 'note');
  const shownComponents = showAllBom ? components : components.slice(0, BOM_PREVIEW_ROWS);
  const filteredImages = imageFilter === 'all'
    ? images
    : images.filter((img) => (img.kind || 'photo') === imageFilter);

  const imageForTab = (key: string): ProjectImage | undefined => {
    if (images.length === 0) return undefined;
    if (key === 'preview') {
      return images.find((i) => i.kind === 'circuit')
        || images.find((i) => i.kind === 'schematic')
        || images.find((i) => i.kind === 'photo')
        || images[0];
    }
    if (key === 'photo') return images.find((i) => i.kind === 'photo' || i.kind === 'wiring');
    if (key === '3d') return undefined;
    return images.find((i) => (i.kind || 'photo') === key);
  };

  const tabImage = imageForTab(tab);
  const confidencePct = stats ? Math.round(stats.avgConfidence * 100) : 0;
  const checkedCount = components.filter((c) => !!c.checked).length;
  // 「主要功能」：优先项目自定义内容，否则回退到教程小节标题
  const featureList = (project?.features
    ? project.features.split('\n')
    : steps.map((s) => s.title)
  ).map((f) => f.trim()).filter(Boolean);
  const owner = isOwner;

  // 本地模式：作品的来源标签（示例 / 模板 / 别人分享 / 自己新建）
  const localSourceTag = !isLocal
    ? null
    : project?.source_type === 'sample'
      ? { label: '示例作品', cls: 'pj-tag pj-tag-green' }
      : project?.source_type === 'template'
        ? { label: '来自模板', cls: 'pj-tag' }
        : project?.source_type === 'shared'
          ? { label: '收到的作品', cls: 'pj-tag pj-tag-blue' }
          : { label: '本机新建', cls: 'pj-tag' };

  const edInputStyle: React.CSSProperties = {
    padding: '9px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    color: 'white',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>加载中...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a18' }}>
        <SiteHeader maxWidth={1400} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', paddingTop: '180px' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>{toast || (isShareView ? '分享不存在或已被取消' : '项目不存在或未公开分享')}</p>
          <div style={{ display: 'flex', gap: '14px' }}>
            {needLogin && <Link href="/login" style={{ color: '#7f9cff', fontSize: '14px', textDecoration: 'none' }}>去登录 →</Link>}
            {isShareView ? (
              <Link href="/community" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textDecoration: 'none' }}>去社区看看</Link>
            ) : (
              <Link href="/projects" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textDecoration: 'none' }}>返回我的项目</Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#070a14', position: 'relative', overflowX: 'hidden', minWidth: '320px' }}>
      <div style={bgGradient} />
      <div style={gridBg} />

      <SiteHeader
        maxWidth={1400}
        homeHref={isLocal ? '/toolbox' : '/'}
        links={isLocal ? [{ href: '/toolbox', label: '工具箱' }] : undefined}
        right={
        isLocal ? (
          <span style={{
            padding: '4px 10px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 700,
            background: 'rgba(34,197,94,0.12)', color: '#6ee7b7',
            border: '1px solid rgba(34,197,94,0.3)', flexShrink: 0,
          }}>
            本地模式
          </span>
        ) : getToken() ? (
          <Link href="/projects" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>
            我的项目
          </Link>
        ) : (
          <Link href="/login" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #7c5cf0 100%)', color: 'white',
            padding: '7px 16px', borderRadius: '9px', textDecoration: 'none',
            fontWeight: 600, fontSize: '13px', flexShrink: 0,
          }}>
            登录 / 注册
          </Link>
        )
      } />

      <main className="pj-main">
        {/* 面包屑 */}
        <nav className="pj-crumb">
          {isLocal ? (
            <button
              type="button"
              className="pj-crumb-link"
              onClick={onBack}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
            >
              我的工具箱
            </button>
          ) : (
            <Link href="/community" className="pj-crumb-link">社区</Link>
          )}
          <span className="pj-crumb-sep">›</span>
          <span className="pj-crumb-cur">{isLocal ? '作品详情' : '项目详情'}</span>
        </nav>

        {/* ===== 标题区 ===== */}
        <section className="pj-card pj-head">
          <div className="pj-head-icon">
            <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
              <rect x="6" y="6" width="28" height="28" rx="5" fill="#0f1a33" stroke="rgba(79,124,255,0.5)" />
              <rect x="15" y="15" width="10" height="10" rx="2" fill="#16264a" stroke="#4f7cff" />
              <path d="M20 6v9M20 25v9M6 20h9M25 20h9" stroke="#4f7cff" strokeWidth="1.4" />
            </svg>
          </div>

          <div className="pj-head-main">
            {editingName ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ ...edInputStyle, fontSize: '20px', fontWeight: 700, flex: '1 1 260px' }}
                />
                <button onClick={handleSaveName} disabled={saving} className="pj-btn pj-btn-primary">保存</button>
                <button onClick={() => setEditingName(false)} className="pj-btn pj-btn-ghost">取消</button>
              </div>
            ) : (
              <h1
                className="pj-title"
                onClick={owner ? () => { setEditName(project.name); setEditingName(true); } : undefined}
                style={{ cursor: owner ? 'pointer' : 'default' }}
                title={owner ? '点击修改项目名称' : undefined}
              >
                {project.name}
              </h1>
            )}

            <div className="pj-meta">
              {(!isLocal || project.source_type === 'shared') && (
                <span className="pj-avatar">{(project.author_name || '?').slice(0, 1).toUpperCase()}</span>
              )}
              <span className="pj-meta-strong">{isLocal && project.source_type !== 'shared' ? '本机作品' : (project.author_name || '本机作品')}</span>
              {isLocal ? (
                <span className="pj-meta-dim">保存在这台电脑 · 更新于 {formatDateTime(project.updated_at)}</span>
              ) : (
                <span className="pj-meta-dim">发布于 {formatDateTime(project.created_at)}</span>
              )}
              {!isLocal && (
                <>
                  <span className="pj-meta-stat"><Icon name="eye" size={14} color="rgba(255,255,255,0.5)" />{formatCount(stats?.views ?? 0)}</span>
                  <span className="pj-meta-stat"><Icon name="star" size={14} color="rgba(255,255,255,0.5)" />{formatCount(stats?.stars ?? 0)}</span>
                </>
              )}
              {isLocal ? (
                <>
                  {/* 难度徽标：始解 = 不用写代码；卍解 = 要写代码，功能更全 */}
                  <span className={`pj-diff pj-diff-${isBankai ? 'bankai' : 'shikai'}`} title={DIFFICULTY_LABEL[isBankai ? 'bankai' : 'shikai'].hint}>
                    {DIFFICULTY_LABEL[isBankai ? 'bankai' : 'shikai'].name} · {DIFFICULTY_LABEL[isBankai ? 'bankai' : 'shikai'].short}
                  </span>
                  {localSourceTag && <span className={localSourceTag.cls}>{localSourceTag.label}</span>}
                </>
              ) : project.is_shared ? (
                <span className="pj-tag pj-tag-green"><Icon name="check" size={12} color="#34d399" />已公开分享</span>
              ) : owner ? (
                <span className="pj-tag">未分享</span>
              ) : null}
            </div>

            {editingNotes ? (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="一句话说明这个项目做了什么..."
                  style={{ ...edInputStyle, flex: '1 1 320px', resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button onClick={handleSaveNotes} disabled={saving} className="pj-btn pj-btn-primary">保存</button>
                  <button onClick={() => setEditingNotes(false)} className="pj-btn pj-btn-ghost">取消</button>
                </div>
              </div>
            ) : (
              <p
                className={`pj-desc${project.notes ? '' : ' pj-desc-empty'}`}
                onClick={owner ? () => { setEditNotes(project.notes || ''); setEditingNotes(true); } : undefined}
                style={{ cursor: owner ? 'pointer' : 'default' }}
              >
                {project.notes || (owner ? '点一下，写句简介…' : '作者还没写简介')}
              </p>
            )}

            {stats && stats.componentTypes.length > 0 && (
              <div className="pj-tags">
                {stats.componentTypes.map((t) => <span key={t} className="pj-tag">{t}</span>)}
              </div>
            )}
          </div>

          <div className="pj-head-actions">
            {isLocal ? (
              <>{extraActions}</>
            ) : owner ? (
              <>
                {project.is_shared ? (
                  <button onClick={() => setShareOpen(true)} className="pj-btn pj-btn-primary">
                    <Icon name="share" size={15} color="#fff" />分享
                  </button>
                ) : (
                  <button onClick={handleShareProject} disabled={sharing} className="pj-btn pj-btn-primary">
                    <Icon name="share" size={15} color="#fff" />{sharing ? '处理中…' : '分享项目'}
                  </button>
                )}
                {project.is_shared && (
                  <button onClick={() => setShareOpen(true)} className="pj-btn pj-btn-ghost">二维码</button>
                )}
              </>
            ) : (
              <>
                <button onClick={handleClone} disabled={cloning} className="pj-btn pj-btn-primary">
                  <Icon name="download" size={15} color="#fff" />{cloning ? '导入中…' : '导入项目'}
                </button>
                <button onClick={() => toggleStar(project.id, true)} className="pj-btn pj-btn-ghost">
                  <Icon name="heart" size={15} color={stats?.starred ? '#f87171' : 'currentColor'} />
                  {stats?.starred ? '已收藏' : '收藏'}
                </button>
              </>
            )}

            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen((v) => !v)} className="pj-btn pj-btn-icon" aria-label="更多操作">
                <Icon name="more" size={16} color="rgba(255,255,255,0.7)" />
              </button>
              {menuOpen && (
                <div className="pj-menu">
                  {isLocal ? (
                    <button className="pj-menu-item pj-menu-danger" onClick={() => { setMenuOpen(false); handleDeleteProject(); }}>
                      <Icon name="trash" size={14} color="#ef4444" />删除作品
                    </button>
                  ) : (
                    <>
                      {project.is_shared && (
                        <>
                          <button className="pj-menu-item" onClick={handleCopyShareLink}>
                            <Icon name="link" size={14} color="rgba(255,255,255,0.6)" />复制分享链接
                          </button>
                          <Link className="pj-menu-item" href={`/share-project/${project.share_token}`} onClick={() => setMenuOpen(false)}>
                            <Icon name="eye" size={14} color="rgba(255,255,255,0.6)" />查看分享页
                          </Link>
                        </>
                      )}
                      {owner ? (
                        <>
                          {project.is_shared && (
                            <button className="pj-menu-item" onClick={() => { setMenuOpen(false); handleUnshareProject(); }}>
                              <Icon name="close" size={14} color="rgba(255,255,255,0.6)" />取消分享
                            </button>
                          )}
                          <button className="pj-menu-item pj-menu-danger" onClick={() => { setMenuOpen(false); handleDeleteProject(); }}>
                            <Icon name="trash" size={14} color="#ef4444" />删除项目
                          </button>
                        </>
                      ) : (
                        <Link className="pj-menu-item" href="/community" onClick={() => setMenuOpen(false)}>
                          <Icon name="share" size={14} color="rgba(255,255,255,0.6)" />去社区看看
                        </Link>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pj-head-ring">
            <div
              className="pj-ring"
              style={{
                background: confidencePct > 0
                  ? `conic-gradient(#22c55e ${confidencePct}%, rgba(255,255,255,0.07) 0)`
                  : 'conic-gradient(rgba(255,255,255,0.12) 0 100%)',
              }}
            >
              <div className="pj-ring-inner">
                <Icon
                  name={confidencePct > 0 ? 'check' : 'info'}
                  size={18}
                  color={confidencePct > 0 ? '#22c55e' : 'rgba(255,255,255,0.4)'}
                />
              </div>
            </div>
            <div>
              <div className="pj-ring-label">AI 识别</div>
              <div className="pj-ring-value">{confidencePct > 0 ? `${confidencePct}%` : '—'}</div>
              <div className="pj-ring-sub">{confidencePct > 0 ? '元器件识别准确率' : '暂无识别数据'}</div>
            </div>
          </div>
        </section>

        {/* ===== 预览 + 项目信息 ===== */}
        <div className="pj-grid-main">
          <Card
            extra={
              <div className="pj-tabs">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => { setTab(t.key); setZoom(100); }}
                    className={`pj-tab${tab === t.key ? ' pj-tab-active' : ''}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            }
          >
            <div className="pj-canvas">
              {tab === '3d' ? (
                <div className="pj-empty">
                  <Icon name="cube" size={30} color="rgba(255,255,255,0.28)" />
                  <p>暂不支持 3D 预览</p>
                  <span>把电路图或实物照片传到「项目图片」里即可在其它标签页查看</span>
                </div>
              ) : tabImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 上传图片由 /api/uploads 提供，无需 next/image 优化 */}
                  <img
                    src={imgUrl(tabImage.image_path)}
                    alt={tabImage.description || `${project.name} ${TABS.find((t) => t.key === tab)?.label || ''}`}
                    onClick={() => setViewer({ src: imgUrl(tabImage.image_path), alt: tabImage.description || project.name })}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      transform: `scale(${zoom / 100})`,
                      transition: 'transform 0.18s ease-out',
                      cursor: 'zoom-in',
                    }}
                  />
                  <button
                    className="pj-canvas-fs"
                    onClick={() => setViewer({ src: imgUrl(tabImage.image_path), alt: tabImage.description || project.name })}
                    aria-label="全屏查看"
                  >
                    <Icon name="expand" size={15} color="rgba(255,255,255,0.75)" />
                  </button>
                </>
              ) : (
                <div className="pj-empty">
                  <Icon name="image" size={30} color="rgba(255,255,255,0.28)" />
                  <p>暂无{TABS.find((t) => t.key === tab)?.label}</p>
                  {owner ? (
                    <label className="pj-btn pj-btn-ghost" style={{ cursor: 'pointer' }}>
                      {uploadingImage ? '上传中…' : '＋ 上传图片'}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={uploadingImage}
                        onChange={(e) => { setUploadKind(tab === 'photo' ? 'photo' : tab === 'schematic' ? 'schematic' : 'circuit'); handleImageUpload(e); }}
                      />
                    </label>
                  ) : (
                    <span>作者还没有上传这类图片</span>
                  )}
                </div>
              )}
            </div>

            <div className="pj-toolbar">
              <button className="pj-tool" onClick={() => setZoom((z) => Math.max(25, z - 25))} aria-label="缩小">
                <Icon name="zoomOut" size={15} color="rgba(255,255,255,0.7)" />
              </button>
              <span className="pj-zoom">{zoom}%</span>
              <button className="pj-tool" onClick={() => setZoom((z) => Math.min(300, z + 25))} aria-label="放大">
                <Icon name="zoomIn" size={15} color="rgba(255,255,255,0.7)" />
              </button>
              <span className="pj-toolbar-sep" />
              <button className="pj-tool" onClick={() => setZoom(100)} aria-label="适应窗口">
                <Icon name="fit" size={15} color="rgba(255,255,255,0.7)" />
              </button>
              {tabImage && tab !== '3d' && (
                <button className="pj-tool" onClick={() => setViewer({ src: imgUrl(tabImage.image_path), alt: project.name })} aria-label="全屏">
                  <Icon name="expand" size={15} color="rgba(255,255,255,0.7)" />
                </button>
              )}
            </div>
          </Card>

          <Card title="项目信息" icon="info">
            <dl className="pj-info">
              <div className="pj-info-row">
                <dt>{isLocal ? '来源' : '作者'}</dt>
                <dd>
                  {(!isLocal || project.source_type === 'shared') && (
                    <span className="pj-avatar pj-avatar-sm">{(project.author_name || '?').slice(0, 1).toUpperCase()}</span>
                  )}
                  {isLocal
                    ? (project.source_type === 'shared'
                      ? `收到自 ${project.author_name || '同学'}`
                      : '这台电脑上的作品')
                    : project.author_name}
                </dd>
              </div>
              <div className="pj-info-row">
                <dt>{isLocal ? '保存在' : '发布时间'}</dt>
                <dd>{formatDateTime(isLocal ? project.updated_at : project.created_at)}</dd>
              </div>
              <div className="pj-info-row"><dt>项目类型</dt><dd>{stats?.projectType || '实物项目'}</dd></div>
              <div className="pj-info-row"><dt>使用元器件</dt><dd>{components.length} 种</dd></div>
              <div className="pj-info-row"><dt>文件大小</dt><dd>{formatSize(stats?.fileSizeBytes || 0)}</dd></div>
              {!isLocal && (
                <div className="pj-info-row">
                  <dt>项目热度</dt>
                  <dd className="pj-info-heat">
                    <span><Icon name="eye" size={14} color="rgba(255,255,255,0.5)" />{formatCount(stats?.views ?? 0)}</span>
                    <span><Icon name="heart" size={14} color="rgba(255,255,255,0.5)" />{formatCount(stats?.stars ?? 0)}</span>
                    <span><Icon name="download" size={14} color="rgba(255,255,255,0.5)" />{formatCount(stats?.clones ?? 0)}</span>
                  </dd>
                </div>
              )}
            </dl>

            <p className="pj-sub-title">项目简介</p>
            <p className="pj-info-text">{project.notes || '作者还没写简介。'}</p>

            {stats && stats.scenarioTags.length > 0 && (
              <>
                <p className="pj-sub-title">适用场景</p>
                <div className="pj-tags">
                  {stats.scenarioTags.map((t) => <span key={t} className="pj-tag pj-tag-blue">{t}</span>)}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* ===== 底部四卡 ===== */}
        <div className="pj-grid-bottom">
          {/* 项目描述 */}
          <Card
            title="项目描述"
            icon="doc"
            extra={owner && !editingDesc ? (
              <button
                className="pj-link-btn"
                onClick={() => {
                  setEditDesc(project.description || '');
                  setEditFeatures(project.features || '');
                  setEditingDesc(true);
                }}
              >
                编辑
              </button>
            ) : undefined}
          >
            {editingDesc ? (
              <div>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={5}
                  placeholder="描述这个项目做了什么、用到哪些器件、实现了什么效果……"
                  style={{ ...edInputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }}
                />
                <p className="pj-sub-title" style={{ marginTop: '12px' }}>
                  主要功能（每行一条）
                </p>
                <textarea
                  value={editFeatures}
                  onChange={(e) => setEditFeatures(e.target.value)}
                  rows={4}
                  placeholder={'实时采集环境温度\nLCD1602 显示温度值\n温度过高时 LED 报警'}
                  style={{ ...edInputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }}
                />
                <div className="pj-edit-row">
                  <button className="pj-btn pj-btn-primary" onClick={handleSaveDescription} disabled={saving}>
                    {saving ? '保存中…' : '保存'}
                  </button>
                  <button className="pj-btn pj-btn-ghost" onClick={() => setEditingDesc(false)}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <p className="pj-text">
                  {project.description
                    || project.notes
                    || (owner ? '点右上角「编辑」，写下这个作品做了什么。' : '作者还没写项目描述。')}
                </p>
                {featureList.length > 0 && (
                  <>
                    <p className="pj-sub-title" style={{ marginTop: '14px' }}>
                      主要功能：{featuresDerived && owner && <span className="pj-dim" style={{ fontWeight: 400 }}>（来自教程小节，点「编辑」可自定义）</span>}
                    </p>
                    <ol className="pj-ol">
                      {featureList.map((f, i) => <li key={`${f}-${i}`}>{f}</li>)}
                    </ol>
                  </>
                )}
              </>
            )}
          </Card>

          {/* 元器件清单（BOM） */}
          <Card
            title="元器件清单（BOM）"
            icon="box"
            extra={
              isLocal ? (
                <button className="pj-link-btn" onClick={() => setAddingComponent((v) => !v)}>
                  {addingComponent ? '收起' : '＋ 添加元件'}
                </button>
              ) : stats && components.length > 0 && confidencePct > 0 ? (
                <span className="pj-chip-green"><Icon name="check" size={12} color="#34d399" />AI 识别 {confidencePct}%</span>
              ) : undefined
            }
          >
            {isLocal && addingComponent && (
              <div className="pj-edit-cell" style={{ marginBottom: '14px' }}>
                <div className="pj-edit-row" style={{ marginBottom: '10px' }}>
                  <button className="pj-btn pj-btn-soft" onClick={() => setPickingFromLibrary(true)}>从元件库选</button>
                  <span className="pj-dim" style={{ fontSize: '12px' }}>
                    {newComp.libraryId ? `已选自元件库（${newComp.libraryId}）` : '也可以直接手写下面的字段'}
                  </span>
                </div>
                <div className="pj-edit-grid">
                  <input
                    value={newComp.name}
                    onChange={(e) => setNewComp({ ...newComp, name: e.target.value, libraryId: undefined })}
                    placeholder="元器件名称（必填），例如：LED 发光二极管"
                    style={{ ...edInputStyle, gridColumn: '1 / -1' }}
                  />
                  <input
                    value={newComp.type}
                    onChange={(e) => setNewComp({ ...newComp, type: e.target.value })}
                    placeholder="类型，例如：电阻 / 电容 / 传感器"
                    style={edInputStyle}
                  />
                  <input
                    value={newComp.model}
                    onChange={(e) => setNewComp({ ...newComp, model: e.target.value })}
                    placeholder="型号或参数，例如：1kΩ / STM32F103"
                    style={edInputStyle}
                  />
                  <input
                    value={newComp.quantity || ''}
                    onChange={(e) => setNewComp({ ...newComp, quantity: Number(e.target.value) || 1 })}
                    placeholder="数量"
                    type="number"
                    style={edInputStyle}
                  />
                </div>
                <div className="pj-edit-row">
                  <button className="pj-btn pj-btn-primary" onClick={handleAddComponent} disabled={saving}>加入作品</button>
                  <button className="pj-btn pj-btn-ghost" onClick={() => { setAddingComponent(false); setNewComp({ name: '', type: '', model: '', quantity: 1 }); }}>取消</button>
                </div>
              </div>
            )}
            {components.length === 0 ? (
              <p className="pj-text pj-dim">
                {isLocal
                  ? '还没有元件。点右上角「＋ 添加元件」手动录入，或用上面的「AI 识别元件」拍照识别。'
                  : <>还没有元器件。到 <Link href="/recognize" className="pj-link">AI 识别</Link> 页识别元件后加入本项目。</>}
              </p>
            ) : (
              <>
                <div className="pj-table-wrap">
                  <table className="pj-table">
                    <thead>
                      <tr>
                        <th>元器件</th>
                        <th>型号/规格</th>
                        <th style={{ textAlign: 'center' }}>数量</th>
                        <th style={{ textAlign: 'center' }}>识别置信度</th>
                        <th style={{ textAlign: 'center' }}>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownComponents.map((comp) => {
                        const pct = Math.round((comp.confidence || 0) * 100);
                        const expanded = editingComponent === comp.id;
                        return (
                          <Fragment key={comp.id}>
                            <tr
                              className={owner ? 'pj-row-clickable' : undefined}
                              onClick={owner ? () => (expanded ? setEditingComponent(null) : handleStartEdit(comp)) : undefined}
                            >
                              <td>
                                <div className="pj-comp">
                                  <span className="pj-comp-thumb">
                                    {comp.image_path ? (
                                      // eslint-disable-next-line @next/next/no-img-element -- 上传图片由 /api/uploads 提供
                                      <img src={imgUrl(comp.image_path)} alt={comp.component_name} />
                                    ) : (
                                      <Icon name="chip" size={16} color="rgba(255,255,255,0.3)" />
                                    )}
                                  </span>
                                  <span className="pj-comp-name">{comp.component_name}</span>
                                </div>
                              </td>
                              <td className="pj-mono">{comp.model || comp.specifications || '—'}</td>
                              <td style={{ textAlign: 'center' }}>{comp.quantity || 1}</td>
                              <td style={{ textAlign: 'center' }}>
                                {pct > 0 ? (
                                  <span className={pct >= 80 ? 'pj-conf-good' : 'pj-conf-mid'}>
                                    <Icon name="check" size={11} color={pct >= 80 ? '#34d399' : '#fbbf24'} />{pct}%
                                  </span>
                                ) : (
                                  <span className="pj-dim">—</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className={comp.checked ? 'pj-chip-green' : 'pj-chip-muted'}
                                  disabled={!owner}
                                  onClick={(e) => { e.stopPropagation(); if (owner) handleToggleChecked(comp.id, !comp.checked); }}
                                  style={{ cursor: owner ? 'pointer' : 'default' }}
                                >
                                  <Icon name="check" size={11} color={comp.checked ? '#34d399' : 'rgba(255,255,255,0.4)'} />
                                  {comp.checked ? '已备齐' : '待备齐'}
                                </button>
                              </td>
                            </tr>
                            {expanded && (
                              <tr>
                                <td colSpan={5} className="pj-edit-cell">
                                  <div className="pj-edit-grid">
                                    <input value={editForm.component_name} onChange={(e) => setEditForm({ ...editForm, component_name: e.target.value })} placeholder="元器件名称" style={edInputStyle} />
                                    <input value={editForm.component_type} onChange={(e) => setEditForm({ ...editForm, component_type: e.target.value })} placeholder="类型" style={edInputStyle} />
                                    <input value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} placeholder="型号/料号" style={edInputStyle} />
                                    <input value={editForm.manufacturer} onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })} placeholder="制造商" style={edInputStyle} />
                                    <input value={editForm.package_type} onChange={(e) => setEditForm({ ...editForm, package_type: e.target.value })} placeholder="封装类型" style={edInputStyle} />
                                    <input value={editForm.pin_count || ''} onChange={(e) => setEditForm({ ...editForm, pin_count: Number(e.target.value) || 0 })} placeholder="引脚数" type="number" style={edInputStyle} />
                                    <input value={editForm.specifications} onChange={(e) => setEditForm({ ...editForm, specifications: e.target.value })} placeholder="规格参数" style={{ ...edInputStyle, gridColumn: '1 / -1' }} />
                                    <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="元器件描述" rows={2} style={{ ...edInputStyle, gridColumn: '1 / -1', resize: 'vertical', fontFamily: 'inherit' }} />
                                  </div>

                                  <div className="pj-edit-row">
                                    <span className="pj-dim" style={{ fontSize: '12px' }}>数量</span>
                                    <button className="pj-tool" onClick={() => handleQuantityChange(comp.id, -1)}>−</button>
                                    <span style={{ fontWeight: 700, fontSize: '13px' }}>{comp.quantity || 1}</span>
                                    <button className="pj-tool" onClick={() => handleQuantityChange(comp.id, 1)}>＋</button>
                                    <span className="pj-toolbar-sep" />
                                    <button className="pj-btn pj-btn-primary" onClick={handleSaveComponent} disabled={saving}>保存</button>
                                    <button className="pj-btn pj-btn-ghost" onClick={() => setEditingComponent(null)}>取消</button>
                                    <button className="pj-btn pj-btn-danger" onClick={() => handleRemoveComponent(comp.id)}>移除</button>
                                  </div>

                                  {editingAnnotation === comp.id ? (
                                    <div className="pj-edit-row">
                                      <input
                                        value={annotationText}
                                        onChange={(e) => setAnnotationText(e.target.value)}
                                        placeholder="添加注解（原理图位号、参数补充、采购链接等）"
                                        style={{ ...edInputStyle, flex: '1 1 240px' }}
                                      />
                                      <button className="pj-btn pj-btn-primary" onClick={() => handleSaveAnnotation(comp.id)} disabled={saving}>保存注解</button>
                                      <button className="pj-btn pj-btn-ghost" onClick={() => setEditingAnnotation(null)}>取消</button>
                                    </div>
                                  ) : (
                                    <div
                                      className={`pj-anno${comp.annotation ? ' pj-anno-filled' : ''}`}
                                      onClick={() => { setAnnotationText(comp.annotation || ''); setEditingAnnotation(comp.id); }}
                                    >
                                      {comp.annotation || '点击添加注解'}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pj-card-foot">
                  {components.length > BOM_PREVIEW_ROWS ? (
                    <button className="pj-link-btn" onClick={() => setShowAllBom((v) => !v)}>
                      {showAllBom ? '收起重单' : `查看全部 ${components.length} 个元器件`} →
                    </button>
                  ) : (
                    <span className="pj-dim" style={{ fontSize: '12px' }}>
                      已备齐 {checkedCount}/{components.length}
                    </span>
                  )}
                  {components.length > BOM_PREVIEW_ROWS && (
                    <span className="pj-dim" style={{ fontSize: '12px', marginLeft: 'auto' }}>
                      已备齐 {checkedCount}/{components.length}
                    </span>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* 项目图片 */}
          <Card
            title="项目图片"
            icon="image"
            extra={
              owner ? (
                <label className="pj-link-btn" style={{ cursor: 'pointer' }}>
                  {uploadingImage ? '上传中…' : '＋ 上传'}
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingImage} onChange={handleImageUpload} />
                </label>
              ) : undefined
            }
          >
            {images.length === 0 ? (
              <div className="pj-empty pj-empty-sm">
                <Icon name="image" size={24} color="rgba(255,255,255,0.28)" />
                <p>暂无图片</p>
                <span>{owner ? '上传原理图、电路图或实物照片' : '作者还没有上传图片'}</span>
              </div>
            ) : (
              <>
                <div className="pj-gallery">
                  <button className="pj-shot pj-shot-big" onClick={() => setViewer({ src: imgUrl(images[0].image_path), alt: images[0].description || project.name })}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- 上传图片由 /api/uploads 提供 */}
                    <img src={imgUrl(images[0].image_path)} alt={images[0].description || '项目图片'} />
                  </button>
                  <div className="pj-shot-row">
                    {images.slice(1, 4).map((img) => (
                      <div key={img.id} className="pj-shot-wrap">
                        <button className="pj-shot" onClick={() => setViewer({ src: imgUrl(img.image_path), alt: img.description || project.name })}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- 上传图片由 /api/uploads 提供 */}
                          <img src={imgUrl(img.image_path)} alt={img.description || '项目图片'} />
                        </button>
                        {owner && (
                          <button className="pj-shot-del" onClick={() => handleDeleteImage(img.id)} aria-label="删除图片">
                            <Icon name="close" size={11} color="#fff" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {showAllImages && (
                  <div className="pj-all-images">
                    <div className="pj-filter">
                      <button className={`pj-tab${imageFilter === 'all' ? ' pj-tab-active' : ''}`} onClick={() => setImageFilter('all')}>全部</button>
                      {Object.entries(KIND_LABELS).map(([k, label]) => (
                        <button key={k} className={`pj-tab${imageFilter === k ? ' pj-tab-active' : ''}`} onClick={() => setImageFilter(k)}>{label}</button>
                      ))}
                    </div>
                    <div className="pj-filter">
                      <span className="pj-dim" style={{ fontSize: '11.5px', alignSelf: 'center' }}>上传为：</span>
                      {Object.entries(KIND_LABELS).map(([k, label]) => (
                        <button key={k} className={`pj-tab${uploadKind === k ? ' pj-tab-active' : ''}`} onClick={() => setUploadKind(k)}>{label}</button>
                      ))}
                    </div>
                    <div className="pj-all-grid">
                      {filteredImages.map((img) => (
                        <div key={img.id} className="pj-shot-wrap">
                          <button className="pj-shot" onClick={() => setViewer({ src: imgUrl(img.image_path), alt: img.description || project.name })}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- 上传图片由 /api/uploads 提供 */}
                            <img src={imgUrl(img.image_path)} alt={img.description || '项目图片'} />
                          </button>
                          <span className="pj-shot-kind">{KIND_LABELS[img.kind || 'photo'] || '实物图'}</span>
                          {owner && (
                            <button className="pj-shot-del" onClick={() => handleDeleteImage(img.id)} aria-label="删除图片">
                              <Icon name="close" size={11} color="#fff" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pj-card-foot">
                  <button className="pj-link-btn" onClick={() => setShowAllImages((v) => !v)}>
                    {showAllImages ? '收起图片' : `查看全部 ${images.length} 张图片`} →
                  </button>
                </div>
              </>
            )}
          </Card>

          {/* 相关项目推荐（本地工具箱没有社区，跳过） */}
          {!isLocal && (
          <Card
            title="相关项目推荐"
            icon="star"
            extra={<Link href="/community" className="pj-link-btn">查看更多 →</Link>}
          >
            {recs.length === 0 ? (
              <p className="pj-text pj-dim">社区里还没有其它公开项目。</p>
            ) : (
              <div className="pj-recs">
                {recs.map((rec) => (
                  <div key={rec.id} className="pj-rec">
                    <Link href={`/projects/${rec.id}`} className="pj-rec-thumb">
                      {rec.cover_path ? (
                        // eslint-disable-next-line @next/next/no-img-element -- 上传图片由 /api/uploads 提供
                        <img src={imgUrl(rec.cover_path)} alt={rec.name} />
                      ) : (
                        <span className="pj-rec-initial">{rec.name.slice(0, 1).toUpperCase()}</span>
                      )}
                    </Link>
                    <div className="pj-rec-body">
                      <Link href={`/projects/${rec.id}`} className="pj-rec-title">{rec.name}</Link>
                      <div className="pj-rec-meta">
                        <span className="pj-avatar pj-avatar-xs">{(rec.author_name || '?').slice(0, 1).toUpperCase()}</span>
                        {rec.author_name}
                      </div>
                      {splitTags(rec.type_tags).length > 0 && (
                        <div className="pj-tags" style={{ marginTop: '6px' }}>
                          {splitTags(rec.type_tags).map((t) => <span key={t} className="pj-tag pj-tag-sm">{t}</span>)}
                        </div>
                      )}
                      <div className="pj-rec-stats">
                        <span><Icon name="eye" size={13} color="rgba(255,255,255,0.45)" />{formatCount(rec.views || 0)}</span>
                        <span><Icon name="heart" size={13} color="rgba(255,255,255,0.45)" />{formatCount(rec.stars || 0)}</span>
                      </div>
                    </div>
                    <button
                      className="pj-star-btn"
                      onClick={() => toggleStar(rec.id, false)}
                      aria-label={rec.starred ? '取消收藏' : '收藏'}
                    >
                      <Icon name="star" size={16} color={rec.starred ? '#fbbf24' : 'rgba(255,255,255,0.35)'} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          )}
        </div>

        {/* ===== 图文教程：制作步骤 / 注意事项 ===== */}
        {(steps.length > 0 || notesSecs.length > 0) && (
          <div className="pj-grid-steps">
            {steps.length > 0 && (
              <Card title={`图文教程（${steps.length} 步）`} icon="doc">
                <div className="pj-steps">
                  {steps.map((s, i) => (
                    <div key={s.id} className="pj-step">
                      <p className="pj-step-title">第 {i + 1} 步 · {s.title}</p>
                      <p className="pj-step-content">{s.content}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {notesSecs.length > 0 && (
              <Card title="注意事项" icon="info">
                <div className="pj-steps">
                  {notesSecs.map((s) => (
                    <div key={s.id} className="pj-note">
                      <p className="pj-note-title">{s.title}</p>
                      <p className="pj-step-content">{s.content}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ===== 程序代码：只有卍解难度的作品才有这一块 ===== */}
        {isLocal && isBankai && (
          <ProjectCodePanel projectId={String(projectId)} onChange={() => void loadProject()} />
        )}
      </main>

      <footer className="pj-footer">
        © 2026 CIRCUITORIUM — 让电子知识不再碎片化
      </footer>

      {/* 分享弹层 */}
      {shareOpen && (
        <div className="pj-overlay" onClick={() => setShareOpen(false)}>
          <div className="pj-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pj-modal-head">
              <span className="pj-card-title"><Icon name="share" size={15} />分享项目</span>
              <button className="pj-btn pj-btn-icon" onClick={() => setShareOpen(false)} aria-label="关闭">
                <Icon name="close" size={15} color="rgba(255,255,255,0.7)" />
              </button>
            </div>
            <div className="pj-share-body">
              {project.share_token ? (
                <>
                  <QRCodeBox text={`${typeof window !== 'undefined' ? window.location.origin : ''}/share-project/${project.share_token}`} size={132} />
                  <p className="pj-share-tip">投屏展示：学生扫码即可打开本项目并一键克隆到自己的项目里</p>
                  <div className="pj-share-link">{`${typeof window !== 'undefined' ? window.location.origin : ''}/share-project/${project.share_token}`}</div>
                  <div className="pj-edit-row" style={{ justifyContent: 'center' }}>
                    <button className="pj-btn pj-btn-primary" onClick={handleCopyShareLink}>复制链接</button>
                    <Link className="pj-btn pj-btn-ghost" href={`/share-project/${project.share_token}`}>查看分享页</Link>
                    <button className="pj-btn pj-btn-danger" onClick={handleUnshareProject} disabled={sharing}>取消分享</button>
                  </div>
                </>
              ) : (
                <div className="pj-empty pj-empty-sm">
                  <p>还没有生成分享链接</p>
                  <button className="pj-btn pj-btn-primary" onClick={handleShareProject} disabled={sharing}>
                    {sharing ? '处理中…' : '生成分享链接'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 图片查看器 */}
      {viewer && (
        <div className="pj-overlay" onClick={() => setViewer(null)}>
          <div className="pj-viewer" onClick={(e) => e.stopPropagation()}>
            <div className="pj-modal-head" style={{ borderBottom: 'none' }}>
              <span className="pj-card-title">{viewer.alt}</span>
              <div className="pj-edit-row" style={{ gap: '6px' }}>
                <button className="pj-tool" onClick={() => setZoom((z) => Math.max(25, z - 25))} aria-label="缩小">
                  <Icon name="zoomOut" size={15} color="rgba(255,255,255,0.7)" />
                </button>
                <span className="pj-zoom">{zoom}%</span>
                <button className="pj-tool" onClick={() => setZoom((z) => Math.min(300, z + 25))} aria-label="放大">
                  <Icon name="zoomIn" size={15} color="rgba(255,255,255,0.7)" />
                </button>
                <button className="pj-tool" onClick={() => setZoom(100)} aria-label="适应窗口">
                  <Icon name="fit" size={15} color="rgba(255,255,255,0.7)" />
                </button>
                <button className="pj-tool" onClick={() => setViewer(null)} aria-label="关闭">
                  <Icon name="close" size={15} color="rgba(255,255,255,0.7)" />
                </button>
              </div>
            </div>
            <div className="pj-viewer-body">
              {/* eslint-disable-next-line @next/next/no-img-element -- 上传图片由 /api/uploads 提供 */}
              <img src={viewer.src} alt={viewer.alt} style={{ transform: `scale(${zoom / 100})`, transition: 'transform 0.18s ease-out' }} />
            </div>
          </div>
        </div>
      )}

      {pickingFromLibrary && (
        <LibraryPicker
          onClose={() => setPickingFromLibrary(false)}
          onPick={(item) => {
            setNewComp({
              name: item.name,
              type: item.category,
              model: (item.commonModels && item.commonModels[0]) || item.package || '',
              quantity: 1,
              libraryId: item.id,
            });
            setPickingFromLibrary(false);
          }}
        />
      )}

      {toast && <div className="pj-toast">{toast}</div>}

      <style jsx global>{`
        .pj-main {
          max-width: 1400px;
          margin: 0 auto;
          padding: clamp(92px, 12vh, 128px) clamp(14px, 3.5vw, 40px) 80px;
          position: relative;
          z-index: 1;
        }
        .pj-crumb { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 14px; }
        .pj-crumb-link { color: rgba(255,255,255,0.55); text-decoration: none; }
        .pj-crumb-link:hover { color: #9db8ff; }
        .pj-crumb-sep { color: rgba(255,255,255,0.25); }
        .pj-crumb-cur { color: #9db8ff; font-weight: 600; }

        .pj-card {
          position: relative;
          background: linear-gradient(165deg, rgba(17,25,45,0.9) 0%, rgba(10,15,28,0.92) 100%);
          border: 1px solid rgba(120,150,255,0.1);
          border-radius: 14px;
          padding: 16px;
          min-width: 0;
        }
        .pj-card-head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; flex-wrap: wrap; margin-bottom: 12px;
        }
        .pj-card-title { display: inline-flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 700; color: #dbe4ff; }
        .pj-card-foot { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); }

        /* 标题区 */
        .pj-head { display: grid; gap: 16px 20px; grid-template-columns: 64px minmax(0,1fr); align-items: start; margin-bottom: 16px; }
        .pj-head-icon {
          width: 64px; height: 64px; border-radius: 14px; display: grid; place-items: center;
          background: linear-gradient(160deg, rgba(30,45,85,0.9), rgba(12,18,34,0.9));
          border: 1px solid rgba(120,150,255,0.18);
        }
        .pj-head-main { min-width: 0; }
        .pj-head-actions, .pj-head-ring { grid-column: 1 / -1; }
        @media (min-width: 1100px) {
          .pj-head { grid-template-columns: 64px minmax(0,1fr) auto auto; }
          .pj-head-actions, .pj-head-ring { grid-column: auto; }
        }
        .pj-title { font-size: clamp(21px, 2.4vw, 30px); font-weight: 800; color: #fff; margin: 0 0 10px; letter-spacing: -0.3px; line-height: 1.25; }
        .pj-meta { display: flex; align-items: center; gap: 6px 10px; flex-wrap: wrap; min-width: 0; font-size: 12.5px; color: rgba(255,255,255,0.5); }
        .pj-meta > * { flex-shrink: 0; }
        /* 窄屏：图标框缩小，给标题/作者信息留出空间 */
        @media (max-width: 640px) {
          .pj-head { grid-template-columns: 48px minmax(0,1fr); }
          .pj-head-icon { width: 48px; height: 48px; border-radius: 12px; }
          .pj-head-icon svg { width: 26px; height: 26px; }
        }
        .pj-meta-strong { color: rgba(255,255,255,0.85); font-weight: 600; }
        .pj-meta-dim { color: rgba(255,255,255,0.42); }
        .pj-meta-stat { display: inline-flex; align-items: center; gap: 5px; color: rgba(255,255,255,0.6); }
        /* 窄屏：浏览量/收藏在「项目信息 → 项目热度」里已有，避免标题行拥挤被裁切 */
        @media (max-width: 640px) { .pj-meta-stat { display: none; } }
        .pj-avatar {
          width: 24px; height: 24px; border-radius: 50%; display: inline-grid; place-items: center;
          background: linear-gradient(140deg, #4f7cff, #7c5cf0); color: #fff; font-size: 11px; font-weight: 800;
        }
        .pj-avatar-sm { width: 20px; height: 20px; font-size: 10px; margin-right: 7px; }
        .pj-avatar-xs { width: 17px; height: 17px; font-size: 9px; }
        .pj-desc { margin: 12px 0 0; font-size: 13.5px; line-height: 1.75; color: rgba(255,255,255,0.62); max-width: 78ch; }
        .pj-desc-empty { color: rgba(255,255,255,0.3); font-style: italic; }
        .pj-tags { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 12px; }
        .pj-tag {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600;
          background: rgba(79,124,255,0.1); color: #9db8ff; border: 1px solid rgba(79,124,255,0.24);
        }
        .pj-tag-sm { font-size: 10.5px; padding: 2px 8px; }
        .pj-tag-blue { background: rgba(79,124,255,0.14); }
        .pj-tag-green { background: rgba(34,197,94,0.12); color: #6ee7b7; border-color: rgba(34,197,94,0.3); }
        .pj-diff { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 800; letter-spacing: 0.5px; border: 1px solid transparent; }
        .pj-diff-shikai { background: rgba(148,163,184,0.14); color: #cbd5e1; border-color: rgba(148,163,184,0.3); }
        .pj-diff-bankai { background: rgba(251,191,36,0.14); color: #fcd34d; border-color: rgba(251,191,36,0.34); }

        .pj-head-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
        .pj-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          padding: 8px 15px; border-radius: 9px; font-size: 13px; font-weight: 600;
          border: 1px solid transparent; cursor: pointer; text-decoration: none; white-space: nowrap;
          transition: filter 0.18s, border-color 0.18s, background 0.18s;
        }
        .pj-btn-primary { background: linear-gradient(135deg, #3b6bff 0%, #4f7cff 100%); color: #fff; box-shadow: 0 6px 18px rgba(59,107,255,0.28); }
        .pj-btn-primary:hover { filter: brightness(1.08); }
        .pj-btn-primary:disabled { opacity: 0.6; cursor: default; }
        .pj-btn-ghost { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.85); border-color: rgba(255,255,255,0.14); }
        .pj-btn-ghost:hover { border-color: rgba(120,150,255,0.45); }
        .pj-btn-danger { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.24); }
        .pj-btn-icon { padding: 8px 10px; background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); }
        .pj-menu {
          position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; min-width: 168px;
          background: #101a30; border: 1px solid rgba(120,150,255,0.18); border-radius: 11px;
          padding: 5px; box-shadow: 0 18px 40px rgba(0,0,0,0.45);
        }
        .pj-menu-item {
          display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
          padding: 8px 10px; border-radius: 8px; border: none; background: transparent;
          color: rgba(255,255,255,0.78); font-size: 12.5px; cursor: pointer; text-decoration: none;
        }
        .pj-menu-item:hover { background: rgba(120,150,255,0.12); }
        .pj-menu-danger { color: #ef4444; }

        .pj-head-ring { display: flex; align-items: center; gap: 12px; }
        .pj-ring { width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; }
        .pj-ring-inner { width: 48px; height: 48px; border-radius: 50%; background: #0a1120; display: grid; place-items: center; }
        .pj-ring-label { font-size: 11.5px; color: rgba(255,255,255,0.5); }
        .pj-ring-value { font-size: 22px; font-weight: 800; color: #eafff3; line-height: 1.1; }
        .pj-ring-sub { font-size: 10.5px; color: rgba(255,255,255,0.35); }

        /* 主区 / 底部栅格 */
        .pj-grid-main { display: grid; gap: 16px; grid-template-columns: 1fr; margin-bottom: 16px; }
        @media (min-width: 1020px) { .pj-grid-main { grid-template-columns: minmax(0, 2.05fr) minmax(0, 1fr); } }
        .pj-grid-bottom { display: grid; gap: 16px; grid-template-columns: 1fr; }
        @media (min-width: 780px) { .pj-grid-bottom { grid-template-columns: minmax(0,1fr) minmax(0,1.5fr); } }
        /* 版心最宽 1400px：更宽的屏幕上不要再切成四列，否则每张卡只有 200 多像素、BOM 表被压扁 */
        .pj-grid-steps { display: grid; gap: 16px; grid-template-columns: 1fr; margin-top: 16px; }
        @media (min-width: 1020px) { .pj-grid-steps { grid-template-columns: minmax(0,1.6fr) minmax(0,1fr); } }

        /* 预览 */
        .pj-tabs { display: flex; gap: 4px; flex-wrap: wrap; min-width: 0; }
        .pj-tab {
          padding: 6px 12px; border-radius: 8px; border: 1px solid transparent; background: transparent;
          color: rgba(255,255,255,0.58); font-size: 12.5px; font-weight: 600; cursor: pointer;
        }
        .pj-tab:hover { color: rgba(255,255,255,0.85); }
        .pj-tab-active { background: rgba(79,124,255,0.16); color: #bcd0ff; border-color: rgba(79,124,255,0.35); }
        .pj-canvas {
          position: relative; aspect-ratio: 2.35 / 1; max-height: 440px; min-height: 200px; border-radius: 11px; overflow: hidden;
          background-color: #080d1a;
          background-image: linear-gradient(rgba(120,150,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(120,150,255,0.06) 1px, transparent 1px);
          background-size: 26px 26px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .pj-canvas img { display: block; }
        .pj-canvas-fs {
          position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; border-radius: 8px;
          background: rgba(10,16,30,0.75); border: 1px solid rgba(255,255,255,0.14); cursor: pointer;
          display: grid; place-items: center;
        }
        .pj-toolbar { display: flex; align-items: center; gap: 6px; margin-top: 10px; justify-content: center; }
        .pj-tool {
          width: 30px; height: 30px; border-radius: 8px; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1); display: grid; place-items: center; cursor: pointer;
          color: rgba(255,255,255,0.8); font-size: 13px;
        }
        .pj-tool:hover { border-color: rgba(120,150,255,0.4); }
        .pj-zoom { min-width: 48px; text-align: center; font-size: 12.5px; color: rgba(255,255,255,0.7); font-variant-numeric: tabular-nums; }
        .pj-toolbar-sep { width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 4px; }
        .pj-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; padding: 24px; }
        .pj-empty p { margin: 0; font-size: 13.5px; color: rgba(255,255,255,0.55); }
        .pj-empty span { font-size: 11.5px; color: rgba(255,255,255,0.35); max-width: 40ch; }
        .pj-empty-sm { padding: 14px; }

        /* 项目信息 */
        .pj-info { margin: 0; }
        .pj-info-row { display: flex; align-items: baseline; gap: 12px; padding: 7px 0; border-bottom: 1px dashed rgba(255,255,255,0.05); }
        .pj-info-row:last-child { border-bottom: none; }
        .pj-info-row dt { flex: 0 0 76px; color: rgba(255,255,255,0.42); font-size: 12.5px; }
        .pj-info-row dd { margin: 0; color: #e8eeff; font-size: 13px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .pj-info-heat { gap: 14px; color: rgba(255,255,255,0.72); }
        .pj-info-heat span { display: inline-flex; align-items: center; gap: 5px; font-variant-numeric: tabular-nums; }
        .pj-sub-title { margin: 14px 0 8px; font-size: 12.5px; font-weight: 700; color: rgba(255,255,255,0.72); }
        .pj-info-text { margin: 0; font-size: 13px; line-height: 1.8; color: rgba(255,255,255,0.6); }

        /* 表格 */
        .pj-table-wrap { overflow-x: auto; }
        .pj-table { width: 100%; border-collapse: collapse; min-width: 460px; }
        .pj-table th {
          text-align: left; padding: 8px 8px; font-size: 11.5px; font-weight: 600;
          color: rgba(255,255,255,0.42); border-bottom: 1px solid rgba(255,255,255,0.08); white-space: nowrap;
        }
        .pj-table td { padding: 9px 8px; font-size: 12.5px; color: rgba(255,255,255,0.62); border-bottom: 1px solid rgba(255,255,255,0.04); }
        .pj-row-clickable { cursor: pointer; }
        .pj-row-clickable:hover td { background: rgba(120,150,255,0.05); }
        .pj-comp { display: flex; align-items: center; gap: 9px; min-width: 0; }
        .pj-comp-thumb {
          width: 34px; height: 34px; border-radius: 8px; overflow: hidden; flex-shrink: 0;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
          display: grid; place-items: center;
        }
        .pj-comp-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .pj-comp-name { color: #eef3ff; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pj-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; color: #9db8ff; }
        .pj-conf-good, .pj-conf-mid { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; }
        .pj-conf-good { color: #34d399; }
        .pj-conf-mid { color: #fbbf24; }
        .pj-chip-green, .pj-chip-muted {
          display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px;
          font-size: 11px; font-weight: 700; border: 1px solid transparent;
        }
        .pj-chip-green { background: rgba(34,197,94,0.12); color: #6ee7b7; border-color: rgba(34,197,94,0.28); }
        .pj-chip-muted { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.5); border-color: rgba(255,255,255,0.1); }
        .pj-edit-cell { background: rgba(79,124,255,0.05); }
        .pj-edit-grid { display: grid; gap: 8px; grid-template-columns: 1fr; }
        @media (min-width: 700px) { .pj-edit-grid { grid-template-columns: 1fr 1fr; } }
        .pj-edit-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .pj-anno {
          margin-top: 10px; padding: 8px 11px; border-radius: 8px; font-size: 12.5px; cursor: pointer;
          background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); color: rgba(255,255,255,0.35);
        }
        .pj-anno-filled { background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.18); color: rgba(255,255,255,0.72); }

        /* 图片 */
        .pj-gallery { display: flex; flex-direction: column; gap: 8px; }
        .pj-shot {
          display: block; width: 100%; padding: 0; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 9px; overflow: hidden; background: #060a14; cursor: pointer;
        }
        .pj-shot:hover { border-color: rgba(120,150,255,0.4); }
        .pj-shot-big img { width: 100%; height: 168px; object-fit: cover; display: block; }
        .pj-shot-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .pj-shot-row .pj-shot img { width: 100%; height: 62px; object-fit: cover; display: block; }
        .pj-shot-wrap { position: relative; }
        .pj-shot-del {
          position: absolute; top: 5px; right: 5px; width: 20px; height: 20px; border-radius: 50%;
          background: rgba(0,0,0,0.65); border: 1px solid rgba(255,255,255,0.18); cursor: pointer;
          display: grid; place-items: center;
        }
        .pj-shot-kind {
          position: absolute; left: 5px; top: 5px; padding: 1px 7px; border-radius: 6px;
          background: rgba(10,16,30,0.8); color: #9db8ff; font-size: 10px; font-weight: 700;
        }
        .pj-all-images { margin-top: 12px; display: flex; flex-direction: column; gap: 9px; }
        .pj-all-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
        .pj-all-grid .pj-shot img { width: 100%; height: 82px; object-fit: cover; display: block; }
        .pj-filter { display: flex; gap: 5px; flex-wrap: wrap; }

        /* 推荐 */
        .pj-recs { display: flex; flex-direction: column; gap: 10px; }
        .pj-rec { display: flex; gap: 11px; align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .pj-rec:last-child { border-bottom: none; padding-bottom: 0; }
        .pj-rec-thumb {
          width: 62px; height: 62px; border-radius: 9px; overflow: hidden; flex-shrink: 0;
          background: linear-gradient(150deg, #1d2a4d, #0d1428); border: 1px solid rgba(255,255,255,0.07);
          display: grid; place-items: center; text-decoration: none;
        }
        .pj-rec-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .pj-rec-initial { color: rgba(255,255,255,0.25); font-size: 20px; font-weight: 800; }
        .pj-rec-body { flex: 1; min-width: 0; }
        .pj-rec-title { display: block; color: #eef3ff; font-size: 13.5px; font-weight: 700; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pj-rec-title:hover { color: #9db8ff; }
        .pj-rec-meta { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: rgba(255,255,255,0.45); margin-top: 4px; }
        .pj-rec-stats { display: flex; gap: 12px; font-size: 11.5px; color: rgba(255,255,255,0.5); margin-top: 7px; }
        .pj-rec-stats span { display: inline-flex; align-items: center; gap: 4px; }
        .pj-star-btn { background: transparent; border: none; cursor: pointer; padding: 2px; flex-shrink: 0; }
        .pj-star-btn:hover { transform: scale(1.1); }

        /* 教程 */
        .pj-steps { display: flex; flex-direction: column; gap: 10px; }
        .pj-step { background: rgba(79,124,255,0.06); border: 1px solid rgba(79,124,255,0.16); border-radius: 10px; padding: 11px 13px; }
        .pj-step-title { margin: 0 0 5px; font-size: 12.5px; font-weight: 700; color: #bcd0ff; }
        .pj-step-content { margin: 0; font-size: 12.5px; line-height: 1.85; color: rgba(255,255,255,0.62); white-space: pre-wrap; }
        .pj-note { background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.18); border-radius: 10px; padding: 11px 13px; }
        .pj-note-title { margin: 0 0 5px; font-size: 12.5px; font-weight: 700; color: #fcd34d; }

        .pj-text { margin: 0; font-size: 13px; line-height: 1.8; color: rgba(255,255,255,0.6); }
        .pj-dim { color: rgba(255,255,255,0.38); }
        .pj-link { color: #9db8ff; text-decoration: none; }
        .pj-link-btn { background: transparent; border: none; color: #7f9cff; font-size: 12.5px; font-weight: 600; cursor: pointer; padding: 0; text-decoration: none; }
        .pj-link-btn:hover { color: #9db8ff; }
        .pj-ol { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 5px; }
        .pj-ol li { font-size: 12.5px; line-height: 1.7; color: rgba(255,255,255,0.6); }

        /* 弹层 */
        .pj-overlay {
          position: fixed; inset: 0; z-index: 200; background: rgba(4,7,14,0.78);
          backdrop-filter: blur(4px); display: grid; place-items: center; padding: 20px;
        }
        .pj-modal {
          width: min(440px, 100%); background: #0d1626; border: 1px solid rgba(120,150,255,0.18);
          border-radius: 16px; padding: 16px; box-shadow: 0 30px 70px rgba(0,0,0,0.55);
        }
        .pj-modal-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 12px; }
        .pj-share-body { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .pj-share-tip { margin: 0; text-align: center; font-size: 12px; color: rgba(255,255,255,0.45); max-width: 34ch; }
        .pj-share-link {
          width: 100%; padding: 9px 11px; border-radius: 8px; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08); color: #9db8ff; font-size: 11.5px;
          word-break: break-all; text-align: center;
        }
        .pj-viewer { width: min(1200px, 96vw); max-height: 92vh; display: flex; flex-direction: column; }
        .pj-viewer-body {
          flex: 1; overflow: auto; display: grid; place-items: center; padding: 8px;
          background-color: #060a14; border-radius: 12px;
          background-image: linear-gradient(rgba(120,150,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(120,150,255,0.05) 1px, transparent 1px);
          background-size: 26px 26px;
        }
        .pj-viewer-body img { max-width: 100%; max-height: 76vh; object-fit: contain; }
        .pj-footer {
          position: relative; z-index: 1; text-align: center; padding: 26px 20px;
          color: rgba(255,255,255,0.28); font-size: 12.5px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .pj-toast {
          position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%); z-index: 300;
          padding: 10px 18px; border-radius: 10px; background: rgba(16,26,48,0.96);
          border: 1px solid rgba(120,150,255,0.25); color: #e8eeff; font-size: 13px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
}
