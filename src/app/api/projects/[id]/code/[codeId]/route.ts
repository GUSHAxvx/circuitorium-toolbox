// 卍解项目 · 单段代码：PATCH 改名/改内容 · DELETE 删除
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

async function requireOwner(request: NextRequest, params: Promise<{ id: string; codeId: string }>) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) return { error: NextResponse.json({ error: '请先登录' }, { status: 401 }) };
  const { id, codeId } = await params;
  const owned = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(id, user.userId);
  if (!owned) return { error: NextResponse.json({ error: '项目不存在' }, { status: 404 }) };
  const row = db.prepare('SELECT * FROM project_code_files WHERE id = ? AND project_id = ?')
    .get(codeId, id) as Record<string, unknown> | undefined;
  if (!row) return { error: NextResponse.json({ error: '这段代码不在了' }, { status: 404 }) };
  return { id, codeId, row };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; codeId: string }> }
) {
  const ctx = await requireOwner(request, params);
  if (ctx.error) return ctx.error;

  const body = await request.json();
  const { name, language, group, content, note } = body as {
    name?: string; language?: string; group?: string; content?: string; note?: string;
  };
  const row = ctx.row as Record<string, unknown>;

  db.prepare(
    `UPDATE project_code_files SET name = ?, language = ?, group_name = ?, content = ?, note = ? WHERE id = ?`
  ).run(
    (name ?? row.name ?? '').toString().slice(0, 80),
    (language ?? row.language ?? '').toString().slice(0, 24),
    (group ?? row.group_name ?? '').toString().slice(0, 16),
    (content ?? row.content ?? '').toString().slice(0, 200_000),
    (note ?? row.note ?? '').toString().slice(0, 200),
    ctx.codeId
  );
  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ctx.id);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; codeId: string }> }
) {
  const ctx = await requireOwner(request, params);
  if (ctx.error) return ctx.error;
  db.prepare('DELETE FROM project_code_files WHERE id = ?').run(ctx.codeId);
  return NextResponse.json({ success: true });
}
