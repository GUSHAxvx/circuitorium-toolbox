import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

// 社区广场：列出所有被公开分享的项目
// 带 Authorization 时额外返回「我是否收藏过」（starred）
export async function GET(request: NextRequest) {
  try {
    const user = getTokenFromHeader(request.headers.get('authorization'));
    const viewerId = user?.userId ?? 0;

    const projects = db.prepare(`
      SELECT p.id, p.name, p.notes, p.share_token, p.share_count, p.updated_at,
             COALESCE(p.views, 0) as views,
             u.username as author_name,
             (SELECT COUNT(*) FROM project_components WHERE project_id = p.id) as component_count,
             (SELECT COUNT(*) FROM project_stars WHERE project_id = p.id) as stars,
             (SELECT COUNT(*) FROM project_stars WHERE project_id = p.id AND user_id = ?) as starred,
             (SELECT image_path FROM project_images WHERE project_id = p.id ORDER BY id ASC LIMIT 1) as cover_path,
             (SELECT GROUP_CONCAT(t, '|') FROM (
                SELECT DISTINCT component_type AS t FROM project_components
                WHERE project_id = p.id AND component_type IS NOT NULL AND component_type <> ''
                ORDER BY component_type LIMIT 2
              )) as type_tags
      FROM projects p
      JOIN users u ON u.id = p.user_id
      WHERE p.is_shared = 1
      ORDER BY p.share_count DESC, p.updated_at DESC
    `).all(viewerId);

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('获取社区项目失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
