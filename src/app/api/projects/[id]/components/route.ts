import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

export async function POST(
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

  const { image_path, component_name, component_type, description, confidence, annotation, quantity, model, manufacturer, package_type, pin_count, specifications } = await request.json();

  if (!component_name) {
    return NextResponse.json({ error: '元器件信息不完整' }, { status: 400 });
  }

  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM project_components WHERE project_id = ?'
  ).get(id) as { max_order: number };

  const qty = typeof quantity === 'number' && quantity > 0 ? quantity : 1;

  const result = db.prepare(
    'INSERT INTO project_components (project_id, image_path, component_name, component_type, description, confidence, annotation, quantity, model, manufacturer, package_type, pin_count, specifications, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    image_path || '',
    component_name,
    component_type || '',
    description || '',
    confidence || 0,
    annotation || '',
    qty,
    model || '',
    manufacturer || '',
    package_type || '',
    typeof pin_count === 'number' ? pin_count : 0,
    specifications || '',
    maxOrder.max_order + 1
  );

  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

  return NextResponse.json({
    success: true,
    component: {
      id: result.lastInsertRowid,
      project_id: Number(id),
      image_path: image_path || '',
      component_name,
      component_type: component_type || '',
      description: description || '',
      confidence: confidence || 0,
      annotation: annotation || '',
      quantity: qty,
      model: model || '',
      manufacturer: manufacturer || '',
      package_type: package_type || '',
      pin_count: typeof pin_count === 'number' ? pin_count : 0,
      specifications: specifications || '',
      sort_order: maxOrder.max_order + 1,
    },
  });
}
