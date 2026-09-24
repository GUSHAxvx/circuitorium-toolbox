import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { id, imageId } = await params;

  const project = db.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  ).get(id, user.userId);

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  db.prepare('DELETE FROM project_images WHERE id = ? AND project_id = ?').run(imageId, id);
  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

  return NextResponse.json({ success: true });
}
