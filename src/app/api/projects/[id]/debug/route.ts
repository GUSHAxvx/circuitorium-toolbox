// 卍解项目 · 调试记录：GET 列表 / POST 新增
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const { id } = await params;
  const project = db.prepare('SELECT user_id, is_shared FROM projects WHERE id = ?').get(id) as
    | { user_id: number; is_shared: number }
    | undefined;
  if (!project) return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  if (project.user_id !== user.userId && !project.is_shared) {
    return NextResponse.json({ error: '项目不存在或未公开分享' }, { status: 404 });
  }

  const rows = db.prepare(
    'SELECT * FROM project_debug_notes WHERE project_id = ? ORDER BY sort_order, id'
  ).all(id);
  return NextResponse.json({ debugNotes: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const { id } = await params;
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
    .get(id, user.userId);
  if (!project) return NextResponse.json({ error: '项目不存在' }, { status: 404 });

  const body = await request.json();
  const { problem, solution } = body as { problem?: string; solution?: string };
  if (!problem || !problem.trim()) {
    return NextResponse.json({ error: '先写一下遇到什么问题' }, { status: 400 });
  }

  const count = (db.prepare('SELECT COUNT(*) as c FROM project_debug_notes WHERE project_id = ?')
    .get(id) as { c: number }).c;

  const info = db.prepare(
    `INSERT INTO project_debug_notes (project_id, problem, solution, sort_order) VALUES (?, ?, ?, ?)`
  ).run(id, problem.trim().slice(0, 300), (solution || '').trim().slice(0, 600), count);
  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  return NextResponse.json({ success: true, id: info.lastInsertRowid });
}
