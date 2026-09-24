import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const templates = db.prepare(
      'SELECT * FROM project_templates ORDER BY sort_order, id'
    ).all();

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('获取项目模板失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
