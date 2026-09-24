import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = getTokenFromHeader(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const history = db.prepare(`
      SELECT id, image_path, component_name, component_type, description, confidence, created_at
      FROM recognition_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(user.userId);

    return NextResponse.json({ history });
  } catch (error) {
    console.error('获取历史错误:', error);
    return NextResponse.json(
      { error: '获取历史失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = getTokenFromHeader(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const { id } = await request.json();

    db.prepare(`
      DELETE FROM recognition_history
      WHERE id = ? AND user_id = ?
    `).run(id, user.userId);

    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除错误:', error);
    return NextResponse.json(
      { error: '删除失败' },
      { status: 500 }
    );
  }
}
