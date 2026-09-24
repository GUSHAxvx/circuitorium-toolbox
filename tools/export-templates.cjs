// 从现有 data.db 导出内置项目模板 -> src/lib/store/templateSeed.ts
// 目的：本地工具箱不需要服务器也要自带教程内容
const fs = require('fs');
const root = 'C:/Users/Administrator/component-recognition-deploy';
const Database = require(root + '/node_modules/better-sqlite3');

const db = new Database(root + '/data.db', { readonly: true });

const templates = db.prepare('SELECT * FROM project_templates ORDER BY sort_order, id').all();

const out = templates.map((t) => {
  const items = db.prepare(
    'SELECT * FROM template_items WHERE template_id = ? ORDER BY sort_order, id'
  ).all(t.id);
  const sections = db.prepare(
    'SELECT * FROM template_sections WHERE template_id = ? ORDER BY sort_order, id'
  ).all(t.id);

  return {
    id: `tpl-${t.id}`,
    name: t.name,
    emoji: t.emoji || '🔧',
    category: t.category || '入门',
    difficulty: t.difficulty || '简单',
    description: t.description || '',
    sortOrder: t.sort_order || 0,
    components: items.map((it, i) => ({
      name: it.component_name,
      type: it.component_type || '',
      model: it.model || '',
      manufacturer: '',
      packageType: it.package_type || '',
      pinCount: 0,
      specifications: '',
      description: it.purpose || '',
      annotation: '',
      quantity: it.quantity || 1,
      checked: false,
      confidence: 0,
      sortOrder: it.sort_order ?? i,
    })),
    sections: sections.map((s, i) => ({
      type: s.type === 'note' ? 'note' : 'step',
      title: s.title,
      content: s.content || '',
      sortOrder: s.sort_order ?? i,
    })),
  };
});

const header = `// 由 data.db 自动导出，请勿手改（重新生成：node tools/export-templates.cjs）
// 内置项目模板：本地工具箱离线自带，无需服务器
import type { ToolboxTemplate } from './types';

export const TEMPLATE_SEED: ToolboxTemplate[] = `;

fs.writeFileSync(
  root + '/src/lib/store/templateSeed.ts',
  header + JSON.stringify(out, null, 2) + ';\n',
  'utf8'
);

console.log('templates:', out.length);
out.forEach((t) => console.log(' -', t.id, t.name, '| 元件', t.components.length, '| 教程', t.sections.length));
