import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

// 分享项目：生成（或复用）分享 token 并公开
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

    const project = db.prepare(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?'
    ).get(id, user.userId) as { id: number; share_token: string | null } | undefined;

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    let token = project.share_token;
    if (!token) {
      token = uuidv4();
      db.prepare('UPDATE projects SET share_token = ?, is_shared = 1 WHERE id = ?').run(token, id);
    } else {
      db.prepare('UPDATE projects SET is_shared = 1 WHERE id = ?').run(id);
    }

    return NextResponse.json({
      success: true,
      share_token: token,
      share_url: `/share-project/${token}`,
    });
  } catch (error) {
    console.error('分享项目失败:', error);
    return NextResponse.json({ error: '分享失败' }, { status: 500 });
  }
}

// 取消分享（保留 token，再次分享时链接不变）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    db.prepare('UPDATE projects SET is_shared = 0 WHERE id = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('取消分享失败:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
