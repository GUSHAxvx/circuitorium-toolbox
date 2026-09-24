import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';
import { instantiateTemplate } from '@/lib/templateService';

// 从模板一键创建项目：创建项目并把模板 BOM 条目与教程复制为项目内容
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

    const template = db.prepare(
      'SELECT * FROM project_templates WHERE id = ?'
    ).get(id) as { id: number; name: string } | undefined;

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    const projectId = instantiateTemplate(user.userId, template.id);

    return NextResponse.json({
      success: true,
      project: { id: projectId, name: template.name },
    });
  } catch (error) {
    console.error('从模板创建项目失败:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
