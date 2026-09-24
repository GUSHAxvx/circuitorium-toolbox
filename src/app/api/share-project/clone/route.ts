import { NextRequest, NextResponse } from 'next/server';
import { copyFileSync, existsSync } from 'fs';
import path from 'path';
import db from '@/lib/db';
import { getTokenFromHeader } from '@/lib/auth';

// 一键克隆分享的项目：复制项目、元器件、教程与图片文件
export async function POST(request: NextRequest) {
  try {
    const user = getTokenFromHeader(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: '无效链接' }, { status: 400 });
    }

    const source = db.prepare(
      'SELECT * FROM projects WHERE share_token = ? AND is_shared = 1'
    ).get(token) as
      | { id: number; user_id: number; name: string; notes: string }
      | undefined;

    if (!source) {
      return NextResponse.json({ error: '分享不存在或已被取消' }, { status: 404 });
    }

    if (source.user_id === user.userId) {
      return NextResponse.json({ error: '不能克隆自己的项目' }, { status: 400 });
    }

    const components = db.prepare(
      'SELECT * FROM project_components WHERE project_id = ? ORDER BY sort_order'
    ).all(source.id) as Array<Record<string, unknown>>;

    const sections = db.prepare(
      'SELECT * FROM project_sections WHERE project_id = ? ORDER BY sort_order'
    ).all(source.id) as Array<Record<string, unknown>>;

    const images = db.prepare(
      'SELECT * FROM project_images WHERE project_id = ? ORDER BY created_at'
    ).all(source.id) as Array<Record<string, unknown>>;

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');

    const create = db.transaction(() => {
      const project = db.prepare(
        'INSERT INTO projects (user_id, name, notes) VALUES (?, ?, ?)'
      ).run(user.userId, source.name, source.notes || '');

      const projectId = Number(project.lastInsertRowid);

      const insertComp = db.prepare(
        `INSERT INTO project_components
          (project_id, image_path, component_name, component_type, description, confidence, annotation, model, manufacturer, package_type, pin_count, specifications, quantity, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      components.forEach((c) => {
        insertComp.run(
          projectId,
          (c.image_path as string) || '',
          c.component_name || '',
          c.component_type || '',
          c.description || '',
          c.confidence || 0,
          c.annotation || '',
          c.model || '',
          c.manufacturer || '',
          c.package_type || '',
          c.pin_count || 0,
          c.specifications || '',
          c.quantity || 1,
          c.sort_order ?? 0
        );
      });

      const insertSection = db.prepare(
        'INSERT INTO project_sections (project_id, type, title, content, sort_order) VALUES (?, ?, ?, ?, ?)'
      );
      sections.forEach((s) => {
        insertSection.run(projectId, s.type || 'step', s.title || '', s.content || '', s.sort_order ?? 0);
      });

      // 复制图片（物理文件 + 记录），源文件缺失则跳过
      const insertImage = db.prepare(
        'INSERT INTO project_images (project_id, image_path, description, kind) VALUES (?, ?, ?, ?)'
      );
      images.forEach((img) => {
        const base = path.basename(String(img.image_path || ''));
        if (!base) return;
        const srcPath = path.join(uploadDir, base);
        if (!existsSync(srcPath)) return;
        const newName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}`;
        const destPath = path.join(uploadDir, newName);
        try {
          copyFileSync(srcPath, destPath);
          insertImage.run(projectId, `/uploads/${newName}`, img.description || '', img.kind || 'photo');
        } catch {
          // 复制失败跳过该图片
        }
      });

      // 统计克隆次数
      db.prepare('UPDATE projects SET share_count = share_count + 1 WHERE id = ?').run(source.id);

      return projectId;
    });

    const projectId = create();

    return NextResponse.json({
      success: true,
      project: { id: projectId, name: source.name },
    });
  } catch (error) {
    console.error('克隆项目失败:', error);
    return NextResponse.json({ error: '克隆失败' }, { status: 500 });
  }
}
