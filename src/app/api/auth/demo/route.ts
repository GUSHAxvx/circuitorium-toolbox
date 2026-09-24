import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { instantiateTemplate } from '@/lib/templateService';
import { v4 as uuidv4 } from 'uuid';

// 课程演示模式：一键登录演示账号（不存在则自动创建，
// 并生成一个含教程的、已公开分享的演示项目）
export async function POST() {
  try {
    const username = 'demo_teacher';
    const email = 'demo_teacher@circuitorium.local';

    let user = db.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).get(username) as { id: number; username: string; email: string } | undefined;

    if (!user) {
      const hashed = await hashPassword('demo123456');
      const info = db.prepare(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)'
      ).run(username, email, hashed);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as
        { id: number; username: string; email: string };
    }

    // 保证演示项目存在（含教程、已分享），供课程展示与社区展示
    let demoProject = db.prepare(
      'SELECT * FROM projects WHERE user_id = ? AND name = ?'
    ).get(user.id, 'LED 呼吸灯（课程演示）') as { id: number } | undefined;

    if (!demoProject) {
      const template = db.prepare(
        "SELECT * FROM project_templates WHERE name = 'LED 呼吸灯'"
      ).get() as { id: number } | undefined;

      let projectId: number | undefined;
      if (template) {
        projectId = instantiateTemplate(user.id, template.id);
        db.prepare(
          "UPDATE projects SET name = 'LED 呼吸灯（课程演示）' WHERE id = ?"
        ).run(projectId);
        // 公开分享演示项目（社区与扫码演示用）
        db.prepare(
          'UPDATE projects SET share_token = ?, is_shared = 1 WHERE id = ?'
        ).run(uuidv4(), projectId);
      }
      demoProject = projectId !== undefined
        ? (db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as { id: number })
        : undefined;
    } else {
      // 演示项目已存在：确保它始终处于「已公开分享」状态
      // （课程演示的社区展示、分享二维码、扫码克隆都依赖它）
      const row = db.prepare('SELECT share_token FROM projects WHERE id = ?')
        .get(demoProject.id) as { share_token: string | null } | undefined;
      if (row?.share_token) {
        db.prepare('UPDATE projects SET is_shared = 1 WHERE id = ?').run(demoProject.id);
      } else {
        db.prepare('UPDATE projects SET share_token = ?, is_shared = 1 WHERE id = ?')
          .run(uuidv4(), demoProject.id);
      }
    }

    const token = generateToken(user.id);

    return NextResponse.json({
      message: '演示登录成功',
      token,
      user: { id: user.id, username: user.username, email: user.email },
      projectId: demoProject?.id ?? null,
    });
  } catch (error) {
    console.error('演示登录失败:', error);
    return NextResponse.json({ error: '演示登录失败' }, { status: 500 });
  }
}
