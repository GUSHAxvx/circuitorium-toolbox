// 卍解项目 · 程序代码：GET 列表 / POST 新增
// 表结构见 src/lib/db.ts（project_code_files）
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

/** 单段代码上限 20 万字符、一个项目最多 40 段——和本地版保持一致 */
const LIMITS = { maxChars: 200_000, maxFiles: 40 };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const { id } = await params;
  // 有权限看这个项目才给看代码（本人或已公开分享）
  const project = db.prepare('SELECT user_id, is_shared FROM projects WHERE id = ?').get(id) as
    | { user_id: number; is_shared: number }
    | undefined;
  if (!project) return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  if (project.user_id !== user.userId && !project.is_shared) {
    return NextResponse.json({ error: '项目不存在或未公开分享' }, { status: 404 });
  }

  const rows = db.prepare(
    'SELECT * FROM project_code_files WHERE project_id = ? ORDER BY sort_order, id'
  ).all(id);
  return NextResponse.json({ codeFiles: rows });
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
  const { name, language, group, content, note, encoding } = body as {
    name?: string; language?: string; group?: string;
    content?: string; note?: string; encoding?: string;
  };
  const text = typeof content === 'string' ? content.slice(0, LIMITS.maxChars) : '';
  if (!text.trim()) return NextResponse.json({ error: '代码是空的' }, { status: 400 });

  const count = (db.prepare('SELECT COUNT(*) as c FROM project_code_files WHERE project_id = ?')
    .get(id) as { c: number }).c;
  if (count >= LIMITS.maxFiles) {
    return NextResponse.json({ error: `一个作品最多放 ${LIMITS.maxFiles} 段代码` }, { status: 400 });
  }

  const info = db.prepare(
    `INSERT INTO project_code_files (project_id, name, language, group_name, content, note, encoding, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    (name || `代码${count + 1}.txt`).slice(0, 80),
    (language || '').slice(0, 24),
    (group || '').slice(0, 16),
    text,
    (note || '').slice(0, 200),
    encoding || 'utf-8',
    count
  );
  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  return NextResponse.json({ success: true, id: info.lastInsertRowid });
}
