'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import {
  pageStyle, bgGradient, gridBg, loadingStyle, footer,
} from '@/styles/theme';

interface Template {
  id: number;
  name: string;
  emoji: string;
  category: string;
  difficulty: string;
  description: string;
  component_count: number;
}

const difficultyColor: Record<string, string> = {
  '简单': '#10b981',
  '中等': '#fbbf24',
  '较难': '#ef4444',
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/templates')
      .then((res) => res.json())
      .then((data) => {
        if (data.templates) {
          setTemplates(data.templates);
        } else {
          setError(data.error || '加载模板失败');
        }
      })
      .catch(() => setError('网络错误，请重试'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={pageStyle}>
      <div style={bgGradient} />
      <div style={gridBg} />

      <SiteHeader />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(96px, 13vh, 120px) clamp(16px, 5vw, 40px) 60px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'white', marginBottom: '12px' }}>
            🧩 项目模板库
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', lineHeight: 1.8, maxWidth: '560px', margin: '0 auto' }}>
            选一个想做的项目，一键生成项目骨架：BOM 元件清单、每个元件的作用说明都帮你准备好了，边做边学。
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '14px 20px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={loadingStyle}>加载中...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {templates.map((t) => (
              <div key={t.id} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '18px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span style={{ fontSize: '40px', lineHeight: 1 }}>{t.emoji}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: 'rgba(102,126,234,0.12)',
                      color: '#a5b4fc',
                      border: '1px solid rgba(102,126,234,0.25)',
                    }}>
                      {t.category}
                    </span>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: 'rgba(255,255,255,0.06)',
                      color: difficultyColor[t.difficulty] || '#fff',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}>
                      {t.difficulty}
                    </span>
                  </div>
                </div>

                <h3 style={{ fontSize: '19px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
                  {t.name}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', lineHeight: 1.7, marginBottom: '14px', flex: 1 }}>
                  {t.description}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginBottom: '14px' }}>
                  📦 {t.component_count} 种元器件 · 含图文教程与注意事项
                </p>

                <Link
                  href={`/templates/${t.id}`}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    width: '100%',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: 700,
                    boxShadow: '0 8px 25px rgba(102, 126, 234, 0.35)',
                    transition: 'all 0.3s',
                    boxSizing: 'border-box',
                  }}
                >
                  📖 查看教程
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer style={footer}>
        <p>© 2026 CIRCUITORIUM — 让电子知识不再碎片化</p>
      </footer>
    </div>
  );
}
