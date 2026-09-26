// 卍解项目 · 接线表的一行：PATCH 改 · DELETE 删
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

async function requireOwner(request: NextRequest, params: Promise<{ id: string; pinId: string }>) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) return { error: NextResponse.json({ error: '请先登录' }, { status: 401 }) };
  const { id, pinId } = await params;
  const owned = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(id, user.userId);
  if (!owned) return { error: NextResponse.json({ error: '项目不存在' }, { status: 404 }) };
  const row = db.prepare('SELECT * FROM project_pin_rows WHERE id = ? AND project_id = ?')
    .get(pinId, id) as Record<string, unknown> | undefined;
  if (!row) return { error: NextResponse.json({ error: '这行接线不在了' }, { status: 404 }) };
  return { id, pinId, row };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pinId: string }> }
) {
  const ctx = await requireOwner(request, params);
  if (ctx.error) return ctx.error;

  const body = await request.json();
  const { module: moduleName, pin, boardPin, note } = body as {
    module?: string; pin?: string; boardPin?: string; note?: string;
  };
  const row = ctx.row as Record<string, unknown>;

  db.prepare(
    'UPDATE project_pin_rows SET module = ?, pin = ?, board_pin = ?, note = ? WHERE id = ?'
  ).run(
    (moduleName ?? row.module ?? '').toString().slice(0, 60),
    (pin ?? row.pin ?? '').toString().slice(0, 40),
    (boardPin ?? row.board_pin ?? '').toString().slice(0, 40),
    (note ?? row.note ?? '').toString().slice(0, 120),
    ctx.pinId
  );
  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ctx.id);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pinId: string }> }
) {
  const ctx = await requireOwner(request, params);
  if (ctx.error) return ctx.error;
  db.prepare('DELETE FROM project_pin_rows WHERE id = ?').run(ctx.pinId);
  return NextResponse.json({ success: true });
}
