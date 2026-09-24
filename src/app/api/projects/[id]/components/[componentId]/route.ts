import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; componentId: string }> }
) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { id, componentId } = await params;

  const project = db.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  ).get(id, user.userId);

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const body = await request.json();
  const sets: string[] = [];
  const vals: (string | number)[] = [];

  const fields: Record<string, string> = {
    component_name: 'component_name',
    component_type: 'component_type',
    description: 'description',
    annotation: 'annotation',
    model: 'model',
    manufacturer: 'manufacturer',
    package_type: 'package_type',
    specifications: 'specifications',
  };

  for (const [key, col] of Object.entries(fields)) {
    if (body[key] !== undefined) {
      sets.push(`${col} = ?`);
      vals.push(body[key]);
    }
  }

  if (typeof body.pin_count === 'number') {
    sets.push('pin_count = ?');
    vals.push(body.pin_count);
  }

  if (typeof body.quantity === 'number' && body.quantity > 0) {
    sets.push('quantity = ?');
    vals.push(body.quantity);
  }

  if (typeof body.checked === 'boolean' || typeof body.checked === 'number') {
    sets.push('checked = ?');
    vals.push(body.checked ? 1 : 0);
  }

  if (sets.length === 0) {
    return NextResponse.json({ success: true });
  }

  vals.push(componentId, id);
  db.prepare(
    `UPDATE project_components SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`
  ).run(...vals);

  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; componentId: string }> }
) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { id, componentId } = await params;

  const project = db.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  ).get(id, user.userId);

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  db.prepare('DELETE FROM project_components WHERE id = ? AND project_id = ?').run(componentId, id);
  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

  return NextResponse.json({ success: true });
}
