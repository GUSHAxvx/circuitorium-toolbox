'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getToken, authHeaders } from '@/lib/client';
import SiteHeader from '@/components/SiteHeader';
import {
  pageStyle, bgGradient, gridBg, loadingStyle,
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

interface TemplateItem {
  id: number;
  component_name: string;
  component_type: string;
  model: string;
  package_type: string;
  quantity: number;
  purpose: string;
}

interface TemplateSection {
  id: number;
  type: string;
  title: string;
  content: string;
}

const difficultyColor: Record<string, string> = {
  '简单': '#10b981',
  '中等': '#fbbf24',
  '较难': '#ef4444',
};

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;
    fetch(`/api/templates/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setTemplate(data.template);
          setItems(data.items || []);
          setSections(data.sections || []);
        }
      })
      .catch(() => setError('网络错误，请重试'))
      .finally(() => setLoading(false));
  }, [params]);

  const handleCreate = async () => {
    if (!template) return;
    if (!getToken()) {
      router.push('/login');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`/api/templates/${template.id}/instantiate`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.project?.id) {
        router.push(`/projects/${data.project.id}`);
      } else {
        setError(data.error || '创建失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setCreating(false);
    }
  };

  const steps = sections.filter((s) => s.type === 'step');
  const notes = sections.filter((s) => s.type === 'note');

  return (
    <div style={pageStyle}>
      <div style={bgGradient} />
      <div style={gridBg} />

      <SiteHeader />

      <main style={{ maxWidth: '860px', margin: '0 auto', padding: 'clamp(96px, 13vh, 120px) clamp(16px, 5vw, 40px) 80px', position: 'relative', zIndex: 1 }}>
        <Link href="/templates" style={{ color: '#667eea', textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '20px' }}>
          ← 返回模板库
        </Link>

        {loading ? (
          <div style={loadingStyle}>加载中...</div>
        ) : !template ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.5)' }}>
            <p style={{ fontSize: '18px', marginBottom: '16px' }}>{error || '模板不存在'}</p>
            <Link href="/templates" style={{ color: '#667eea', textDecoration: 'none' }}>返回模板库</Link>
          </div>
        ) : (
          <>
            {/* 模板头部 */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '18px',
              padding: '28px',
              marginBottom: '24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '48px', lineHeight: 1 }}>{template.emoji}</span>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>{template.name}</h1>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                      background: 'rgba(102,126,234,0.12)', color: '#a5b4fc', border: '1px solid rgba(102,126,234,0.25)',
                    }}>{template.category}</span>
                    <span style={{
                      padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                      background: 'rgba(255,255,255,0.06)', color: difficultyColor[template.difficulty] || '#fff', border: '1px solid rgba(255,255,255,0.15)',
                    }}>{template.difficulty}</span>
                    <span style={{
                      padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                      background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.25)',
                    }}>📦 {template.component_count} 种元件</span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: 1.8 }}>{template.description}</p>
                </div>
              </div>
            </div>

            {/* BOM 清单预览 */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '18px',
              padding: '24px',
              marginBottom: '24px',
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '16px' }}>📦 元器件清单（BOM）</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>元件名称</th>
                      <th style={{ textAlign: 'left', padding: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>型号/料号</th>
                      <th style={{ textAlign: 'left', padding: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>封装</th>
                      <th style={{ textAlign: 'center', padding: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>数量</th>
                      <th style={{ textAlign: 'left', padding: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>作用说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td style={{ padding: '10px 8px', color: 'white', fontSize: '13px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{it.component_name}</td>
                        <td style={{ padding: '10px 8px', color: '#a5b4fc', fontSize: '12px', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{it.model || '—'}</td>
                        <td style={{ padding: '10px 8px', color: 'rgba(255,255,255,0.6)', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{it.package_type || '—'}</td>
                        <td style={{ padding: '10px 8px', color: 'white', fontSize: '13px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>×{it.quantity}</td>
                        <td style={{ padding: '10px 8px', color: 'rgba(255,255,255,0.55)', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{it.purpose || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 制作步骤 */}
            {steps.length > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '18px',
                padding: '24px',
                marginBottom: '24px',
              }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '16px' }}>📖 制作步骤</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {steps.map((s, i) => (
                    <div key={s.id} style={{
                      background: 'rgba(102,126,234,0.06)',
                      border: '1px solid rgba(102,126,234,0.15)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                    }}>
                      <p style={{ fontWeight: 700, color: '#a5b4fc', fontSize: '14px', marginBottom: '8px' }}>
                        第 {i + 1} 步 · {s.title}
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.65)', whiteSpace: 'pre-wrap', lineHeight: 1.9, fontSize: '13px', fontFamily: 'inherit' }}>
                        {s.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 注意事项 */}
            {notes.length > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '18px',
                padding: '24px',
                marginBottom: '24px',
              }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '16px' }}>⚠️ 注意事项</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {notes.map((s) => (
                    <div key={s.id} style={{
                      background: 'rgba(251,191,36,0.07)',
                      border: '1px solid rgba(251,191,36,0.18)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                    }}>
                      <p style={{ fontWeight: 700, color: '#fcd34d', fontSize: '13px', marginBottom: '6px' }}>{s.title}</p>
                      <p style={{ color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '12.5px' }}>{s.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 创建按钮 */}
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{
                width: '100%',
                padding: '16px',
                background: creating ? 'rgba(102,126,234,0.4)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '14px',
                fontSize: '17px',
                fontWeight: 700,
                cursor: creating ? 'not-allowed' : 'pointer',
                boxShadow: '0 10px 30px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s',
              }}
            >
              {creating ? '创建中...' : '🚀 一键创建项目（含 BOM 清单与教程）'}
            </button>
            {error && (
              <p style={{ textAlign: 'center', color: '#ef4444', fontSize: '13px', marginTop: '12px' }}>{error}</p>
            )}
            {!getToken() && (
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '12px' }}>
                创建项目需要登录，<Link href="/login" style={{ color: '#667eea', textDecoration: 'none' }}>去登录</Link>
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
