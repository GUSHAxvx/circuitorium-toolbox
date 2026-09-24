import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';
import { buildStats, resolveFeatures } from '@/lib/projectView';

export interface ProjectRow {
  id: number;
  user_id: number;
  name: string;
  notes: string;
  description?: string;
  features?: string;
  is_shared: number;
  share_token: string | null;
  share_count: number;
  views: number;
  created_at: string;
  updated_at: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { id } = await params;

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const isOwner = project.user_id === user.userId;
  // 非本人只能查看「已公开分享」的项目
  if (!isOwner && !project.is_shared) {
    return NextResponse.json({ error: '项目不存在或未公开分享' }, { status: 404 });
  }

  // 浏览量 +1（用于项目热度展示）
  db.prepare('UPDATE projects SET views = COALESCE(views, 0) + 1 WHERE id = ?').run(id);
  project.views = (project.views || 0) + 1;

  const components = db.prepare(
    'SELECT * FROM project_components WHERE project_id = ? ORDER BY sort_order, created_at DESC'
  ).all(id) as Array<{ image_path?: string; component_type?: string; confidence?: number }>;

  const sections = db.prepare(
    'SELECT * FROM project_sections WHERE project_id = ? ORDER BY sort_order'
  ).all(id) as Array<{ type?: string; title?: string }>;

  const images = db.prepare(
    'SELECT * FROM project_images WHERE project_id = ? ORDER BY created_at DESC'
  ).all(id) as Array<{ image_path?: string; kind?: string }>;

  const author = db.prepare('SELECT username FROM users WHERE id = ?')
    .get(project.user_id) as { username: string } | undefined;

  const stars = (db.prepare('SELECT COUNT(*) as c FROM project_stars WHERE project_id = ?')
    .get(id) as { c: number }).c;

  const starred = db.prepare('SELECT 1 FROM project_stars WHERE project_id = ? AND user_id = ?')
    .get(id, user.userId) ? 1 : 0;

  const { features, derived } = resolveFeatures(project.features, sections);

  return NextResponse.json({
    project: { ...project, features, author_name: author?.username || '' },
    featuresDerived: derived,
    components,
    sections,
    images,
    isOwner,
    stats: buildStats(project, components, images, stars, starred),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, notes, description, features } = body as {
    name?: string; notes?: string; description?: string; features?: string;
  };

  const project = db.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  ).get(id, user.userId) as ProjectRow | undefined;

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  db.prepare(
    `UPDATE projects SET name = ?, notes = ?, description = ?, features = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(
    name ?? project.name,
    notes ?? project.notes,
    description ?? project.description ?? '',
    features ?? project.features ?? '',
    id
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { id } = await params;

  const project = db.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  ).get(id, user.userId);

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(id);

  return NextResponse.json({ success: true });
}
