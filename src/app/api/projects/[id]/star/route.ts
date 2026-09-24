import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

// 收藏 / 取消收藏项目（项目热度里的「收藏」）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getTokenFromHeader(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;

    const project = db.prepare('SELECT id, user_id, is_shared FROM projects WHERE id = ?')
      .get(id) as { id: number; user_id: number; is_shared: number } | undefined;

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    // 只能收藏自己可见的项目（本人的，或他人已公开分享的）
    if (project.user_id !== user.userId && !project.is_shared) {
      return NextResponse.json({ error: '项目未公开分享' }, { status: 404 });
    }

    const existing = db.prepare(
      'SELECT id FROM project_stars WHERE project_id = ? AND user_id = ?'
    ).get(id, user.userId) as { id: number } | undefined;

    if (existing) {
      db.prepare('DELETE FROM project_stars WHERE id = ?').run(existing.id);
    } else {
      db.prepare('INSERT INTO project_stars (project_id, user_id) VALUES (?, ?)').run(id, user.userId);
    }

    const stars = (db.prepare('SELECT COUNT(*) as c FROM project_stars WHERE project_id = ?')
      .get(id) as { c: number }).c;

    return NextResponse.json({ success: true, starred: existing ? 0 : 1, stars });
  } catch (error) {
    console.error('收藏项目失败:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
