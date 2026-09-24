'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import {
  pageStyle, bgGradient, gridBg, loadingStyle, footer,
} from '@/styles/theme';

interface CommunityProject {
  id: number;
  name: string;
  notes: string;
  share_token: string;
  share_count: number;
  author_name: string;
  component_count: number;
  updated_at: string;
}

export default function CommunityPage() {
  const [projects, setProjects] = useState<CommunityProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/community')
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) {
          setProjects(data.projects);
        } else {
          setError(data.error || '加载失败');
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
            🌐 项目社区
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', lineHeight: 1.8, maxWidth: '560px', margin: '0 auto' }}>
            这里是大佬们公开分享的项目。挑一个感兴趣的，克隆到自己的项目里，照着步骤动手做！
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '14px 20px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={loadingStyle}>加载中...</div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.4)' }}>
            <span style={{ fontSize: '56px', display: 'block', marginBottom: '16px' }}>🔌</span>
            <p style={{ fontSize: '17px', marginBottom: '10px' }}>社区还很安静</p>
            <p style={{ fontSize: '14px', marginBottom: '24px' }}>把你的项目分享出来，成为第一个被克隆的大佬！</p>
            <Link href="/projects" style={{ color: '#667eea', textDecoration: 'none', fontWeight: 600 }}>去分享我的项目 →</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/share-project/${p.share_token}`}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  padding: '22px',
                  textDecoration: 'none',
                  display: 'block',
                  transition: 'all 0.3s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(102,126,234,0.4)';
                  e.currentTarget.style.background = 'rgba(102,126,234,0.06)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>📂 {p.name}</h3>
                  <span style={{
                    padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700,
                    background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)',
                    whiteSpace: 'nowrap',
                  }}>
                    🔁 {p.share_count || 0}
                  </span>
                </div>
                {p.notes && (
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', lineHeight: 1.7, marginBottom: '12px' }}>
                    {p.notes.length > 60 ? p.notes.slice(0, 60) + '...' : p.notes}
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                  <span>👤 {p.author_name}</span>
                  <span>{p.component_count} 个元器件 · {p.updated_at.slice(0, 10)}</span>
                </div>
              </Link>
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
