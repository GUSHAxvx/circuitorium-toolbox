import db from '@/lib/db';

interface TemplateRow {
  id: number;
  name: string;
  description: string;
}

// 从模板创建项目：复制 BOM 条目与教程内容，返回新项目 id
export function instantiateTemplate(userId: number, templateId: number): number {
  const template = db.prepare(
    'SELECT * FROM project_templates WHERE id = ?'
  ).get(templateId) as TemplateRow | undefined;

  if (!template) {
    throw new Error('模板不存在');
  }

  const items = db.prepare(
    'SELECT * FROM template_items WHERE template_id = ? ORDER BY sort_order'
  ).all(templateId) as Array<{
    component_name: string;
    component_type: string;
    model: string;
    package_type: string;
    quantity: number;
    purpose: string;
    sort_order: number;
  }>;

  const sections = db.prepare(
    'SELECT * FROM template_sections WHERE template_id = ? ORDER BY sort_order'
  ).all(templateId) as Array<{
    type: string;
    title: string;
    content: string;
    sort_order: number;
  }>;

  const create = db.transaction(() => {
    const project = db.prepare(
      'INSERT INTO projects (user_id, name, notes) VALUES (?, ?, ?)'
    ).run(userId, template.name, template.description || '');

    const projectId = Number(project.lastInsertRowid);

    const insert = db.prepare(
      `INSERT INTO project_components
        (project_id, image_path, component_name, component_type, description, confidence, annotation, model, package_type, pin_count, specifications, quantity, sort_order)
       VALUES (?, '', ?, ?, ?, 0, '', ?, ?, 0, '', ?, ?)`
    );

    items.forEach((item) => {
      insert.run(
        projectId,
        item.component_name,
        item.component_type || '',
        // 模板条目的"用途说明"放在描述栏，便于在项目中直接查看
        item.purpose || '',
        item.model || '',
        item.package_type || '',
        typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
        item.sort_order ?? 0
      );
    });

    const insertSection = db.prepare(
      'INSERT INTO project_sections (project_id, type, title, content, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    sections.forEach((s) => {
      insertSection.run(projectId, s.type, s.title, s.content, s.sort_order);
    });

    return projectId;
  });

  return create();
}
