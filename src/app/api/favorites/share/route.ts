import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { favorite_id } = await request.json();

    const authHeader = request.headers.get('authorization');
    const user = getTokenFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    // 仅允许分享自己的收藏
    const favorite = db.prepare(
      'SELECT * FROM favorites WHERE id = ? AND user_id = ?'
    ).get(favorite_id, user.userId);

    if (!favorite) {
      return NextResponse.json({ error: '收藏不存在' }, { status: 404 });
    }

    const shareToken = uuidv4();

    db.prepare('INSERT INTO shares (favorite_id, share_token) VALUES (?, ?)').run(favorite_id, shareToken);

    return NextResponse.json({
      share_url: `/share/${shareToken}`
    });
  } catch (error) {
    console.error('分享错误:', error);
    return NextResponse.json({ error: '分享失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: '无效链接' }, { status: 400 });
    }

    const share = db.prepare(`
      SELECT f.* FROM shares s
      JOIN favorites f ON s.favorite_id = f.id
      WHERE s.share_token = ?
    `).get(token);

    if (!share) {
      return NextResponse.json({ error: '分享不存在或已失效' }, { status: 404 });
    }

    return NextResponse.json({ favorite: share });
  } catch (error) {
    console.error('获取分享错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
