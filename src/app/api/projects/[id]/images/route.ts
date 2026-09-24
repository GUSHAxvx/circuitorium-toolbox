import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function GET(
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

  const images = db.prepare(
    'SELECT * FROM project_images WHERE project_id = ? ORDER BY created_at DESC'
  ).all(id);

  return NextResponse.json({ images });
}

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

  const formData = await request.formData();
  const file = formData.get('image') as File | null;
  const description = (formData.get('description') as string) || '';
  const kindRaw = (formData.get('kind') as string) || 'photo';
  // 图片分类：schematic 原理图 / circuit 电路图 / wiring 接线图 / photo 实物图
  const ALLOWED_KINDS = ['schematic', 'circuit', 'wiring', 'photo'];
  const kind = ALLOWED_KINDS.includes(kindRaw) ? kindRaw : 'photo';

  if (!file) {
    return NextResponse.json({ error: '请上传图片' }, { status: 400 });
  }

  // 与识别上传保持一致的限制：最大 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: '图片大小不能超过10MB' }, { status: 400 });
  }

  // 空 type 放行（保持兼容），明确非图片的类型拒绝
  if (file.type && !file.type.startsWith('image/')) {
    return NextResponse.json({ error: '请上传图片文件' }, { status: 400 });
  }

  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  // 清洗文件名，防止路径穿越
  const rawName = path.basename(file.name || '') || 'upload';
  const safeName = rawName.replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '');
  const fileName = `${Date.now()}-${safeName}${path.extname(safeName) ? '' : '.jpg'}`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  await writeFile(filePath, buffer);

  const result = db.prepare(
    'INSERT INTO project_images (project_id, image_path, description, kind) VALUES (?, ?, ?, ?)'
  ).run(id, `/uploads/${fileName}`, description, kind);

  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

  return NextResponse.json({
    success: true,
    image: {
      id: result.lastInsertRowid,
      project_id: Number(id),
      image_path: `/uploads/${fileName}`,
      description,
      kind,
    },
  });
}
