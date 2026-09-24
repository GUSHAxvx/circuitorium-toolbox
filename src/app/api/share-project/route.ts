import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';
import { buildStats, resolveFeatures } from '@/lib/projectView';

// 公开获取分享的项目文档（无需登录）——返回与 /api/projects/[id] 相同的结构，
// 便于项目页与分享页共用同一套界面组件
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: '无效链接' }, { status: 400 });
    }

    // 登录用户（可选）用于判断是否已收藏
    const viewer = getTokenFromHeader(request.headers.get('authorization'));

    const project = db.prepare(`
      SELECT p.*, u.username as author_name
      FROM projects p
      JOIN users u ON u.id = p.user_id
      WHERE p.share_token = ? AND p.is_shared = 1
    `).get(token) as (Record<string, unknown> & {
      id: number; user_id: number; name: string; notes: string;
      description?: string; features?: string; share_count: number; views: number;
      author_name: string;
    }) | undefined;

    if (!project) {
      return NextResponse.json({ error: '分享不存在或已被取消' }, { status: 404 });
    }

    // 浏览量 +1（分享页同样计入）
    db.prepare('UPDATE projects SET views = COALESCE(views, 0) + 1 WHERE id = ?').run(project.id);
    project.views = (project.views || 0) + 1;

    const components = db.prepare(
      'SELECT * FROM project_components WHERE project_id = ? ORDER BY sort_order, created_at DESC'
    ).all(project.id) as Array<{ image_path?: string; component_type?: string; confidence?: number }>;

    const sections = db.prepare(
      'SELECT * FROM project_sections WHERE project_id = ? ORDER BY sort_order'
    ).all(project.id) as Array<{ type?: string; title?: string }>;

    const images = db.prepare(
      'SELECT * FROM project_images WHERE project_id = ? ORDER BY created_at DESC'
    ).all(project.id) as Array<{ image_path?: string; kind?: string }>;

    const stars = (db.prepare('SELECT COUNT(*) as c FROM project_stars WHERE project_id = ?')
      .get(project.id) as { c: number }).c;

    const starred = viewer
      ? (db.prepare('SELECT 1 FROM project_stars WHERE project_id = ? AND user_id = ?')
        .get(project.id, viewer.userId) ? 1 : 0)
      : 0;

    const { features, derived } = resolveFeatures(project.features, sections);

    return NextResponse.json({
      project: { ...project, features },
      featuresDerived: derived,
      components,
      sections,
      images,
      isOwner: false,
      stats: buildStats(project, components, images, stars, starred),
    });
  } catch (error) {
    console.error('获取分享项目失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
