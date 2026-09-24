import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = getTokenFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const favorites = db.prepare(`
      SELECT * FROM favorites
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(user.userId);

    return NextResponse.json({ favorites });
  } catch (error) {
    console.error('获取收藏错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = getTokenFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { image_path, component_name, component_type, description, confidence } = await request.json();

    const existing = db.prepare(`
      SELECT id FROM favorites
      WHERE user_id = ? AND image_path = ?
    `).get(user.userId, image_path);

    if (existing) {
      return NextResponse.json({ error: '已收藏' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO favorites (user_id, image_path, component_name, component_type, description, confidence)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.userId, image_path, component_name, component_type, description, confidence);

    return NextResponse.json({
      message: '收藏成功',
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('收藏错误:', error);
    return NextResponse.json({ error: '收藏失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = getTokenFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id, component_name, component_type, description, notes } = await request.json();

    db.prepare(`
      UPDATE favorites
      SET component_name = ?, component_type = ?, description = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(component_name, component_type, description, notes, id, user.userId);

    return NextResponse.json({ message: '更新成功' });
  } catch (error) {
    console.error('更新收藏错误:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = getTokenFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id } = await request.json();

    db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?').run(id, user.userId);

    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除收藏错误:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
