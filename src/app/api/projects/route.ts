import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const projects = db.prepare(
    `SELECT p.*, 
      (SELECT COUNT(*) FROM project_components WHERE project_id = p.id) as component_count,
      (SELECT image_path FROM project_images WHERE project_id = p.id ORDER BY id ASC LIMIT 1) as cover_path,
      (SELECT GROUP_CONCAT(t, '|') FROM (
         SELECT DISTINCT component_type AS t FROM project_components
         WHERE project_id = p.id AND component_type IS NOT NULL AND component_type <> ''
         ORDER BY component_type LIMIT 2
       )) as type_tags
     FROM projects p 
     WHERE p.user_id = ? 
     ORDER BY p.updated_at DESC`
  ).all(user.userId);

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const user = getTokenFromHeader(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { name, notes, difficulty } = await request.json();

  if (!name || !name.trim()) {
    return NextResponse.json({ error: '请输入项目名称' }, { status: 400 });
  }

  // 难度：始解（不用写代码，默认）/ 卍解（要写代码）
  const level = difficulty === 'bankai' ? 'bankai' : 'shikai';

  const result = db.prepare(
    'INSERT INTO projects (user_id, name, notes, difficulty) VALUES (?, ?, ?, ?)'
  ).run(user.userId, name.trim(), notes || '', level);

  return NextResponse.json({
    success: true,
    project: { id: result.lastInsertRowid, name: name.trim(), notes: notes || '', difficulty: level },
  });
}
