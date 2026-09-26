// 卍解项目 · 一条调试记录：PATCH 改 · DELETE 删
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

async function requireOwner(request: NextRequest, params: Promise<{ id: string; debugId: string }>) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) return { error: NextResponse.json({ error: '请先登录' }, { status: 401 }) };
  const { id, debugId } = await params;
  const owned = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(id, user.userId);
  if (!owned) return { error: NextResponse.json({ error: '项目不存在' }, { status: 404 }) };
  const row = db.prepare('SELECT * FROM project_debug_notes WHERE id = ? AND project_id = ?')
    .get(debugId, id) as Record<string, unknown> | undefined;
  if (!row) return { error: NextResponse.json({ error: '这条记录不在了' }, { status: 404 }) };
  return { id, debugId, row };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; debugId: string }> }
) {
  const ctx = await requireOwner(request, params);
  if (ctx.error) return ctx.error;

  const body = await request.json();
  const { problem, solution } = body as { problem?: string; solution?: string };
  const row = ctx.row as Record<string, unknown>;

  db.prepare('UPDATE project_debug_notes SET problem = ?, solution = ? WHERE id = ?').run(
    (problem ?? row.problem ?? '').toString().slice(0, 300),
    (solution ?? row.solution ?? '').toString().slice(0, 600),
    ctx.debugId
  );
  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ctx.id);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; debugId: string }> }
) {
  const ctx = await requireOwner(request, params);
  if (ctx.error) return ctx.error;
  db.prepare('DELETE FROM project_debug_notes WHERE id = ?').run(ctx.debugId);
  return NextResponse.json({ success: true });
}
