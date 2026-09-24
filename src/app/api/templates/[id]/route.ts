import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const template = db.prepare(
      'SELECT * FROM project_templates WHERE id = ?'
    ).get(id);

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    const items = db.prepare(
      'SELECT * FROM template_items WHERE template_id = ? ORDER BY sort_order'
    ).all(id);

    const sections = db.prepare(
      'SELECT * FROM template_sections WHERE template_id = ? ORDER BY sort_order'
    ).all(id);

    return NextResponse.json({ template, items, sections });
  } catch (error) {
    console.error('获取模板详情失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
