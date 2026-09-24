'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Favorite } from '@/lib/types';
import SiteHeader from '@/components/SiteHeader';
import {
  pageStyle, bgGradient, gridBg, loadingStyle,
} from '@/styles/theme';

export default function SharePage() {
  const params = useParams();
  const [favorite, setFavorite] = useState<Favorite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.token as string;
    if (token) {
      fetch(`/api/favorites/share?token=${token}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setError(data.error);
          } else {
            setFavorite(data.favorite);
          }
        })
        .catch(() => setError('加载失败'))
        .finally(() => setLoading(false));
    }
  }, [params]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={loadingStyle}>加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={bgGradient} />
        <div style={gridBg} />
        <div style={errorWrapper}>
          <span style={{ fontSize: '50px', marginBottom: '20px', display: 'block' }}>😕</span>
          <p style={errorText}>{error}</p>
          <Link href="/" style={primaryBtn}>返回首页</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={bgGradient} />
      <div style={gridBg} />

      {/* 浮动装饰 */}
      <div style={{ position: 'absolute', top: '10%', left: '10%', fontSize: '80px', opacity: 0.05 }}>🔬</div>

      <SiteHeader links={[
        { href: '/', label: '首页' },
        { href: '/community', label: '社区' },
      ]} />

      <main style={{ maxWidth: '700px', margin: '0 auto', padding: 'clamp(92px, 13vh, 100px) clamp(16px, 5vw, 30px) 60px', position: 'relative', zIndex: 1 }}>
        <div style={shareCard}>
          <div style={imageWrapper}>
            <img src={favorite?.image_path} alt={favorite?.component_name} style={image} loading="lazy" />
            <div style={badge}>{((favorite?.confidence ?? 0) * 100).toFixed(0)}%</div>
          </div>
          
          <div style={content}>
            <h2 style={title}>{favorite?.component_name}</h2>
            <p style={type}>{favorite?.component_type}</p>
            
            <div style={descBox}>
              <h3 style={descTitle}>📖 描述</h3>
              <p style={descText}>{favorite?.description}</p>
            </div>
            
            {favorite?.notes && (
              <div style={notesBox}>
                <h3 style={notesTitle}>📝 备注</h3>
                <p style={notesText}>{favorite.notes}</p>
              </div>
            )}
            
            <div style={actionBox}>
              <Link href="/" style={actionBtn}>
                开始自己的识别之旅 →
              </Link>
            </div>
          </div>
        </div>

        <div style={brandBox}>
          <p style={brandText}>分享来自 <strong>CIRCUITORIUM</strong> — 让电子知识不再碎片化</p>
        </div>
      </main>

      <footer style={footer}>
        <p>© 2026 CIRCUITORIUM — 让电子知识不再碎片化</p>
      </footer>
    </div>
  );
}

// 以下共享样式见 @/styles/theme：pageStyle、bgGradient、gridBg、loadingStyle、headerStyle、logoStyle、logoText

const errorWrapper: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  textAlign: 'center' as const,
  paddingTop: '100px',
};

const errorText: React.CSSProperties = {
  color: '#ef4444',
  fontSize: '20px',
  marginBottom: '20px',
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 30px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  borderRadius: '25px',
  textDecoration: 'none',
  fontWeight: 600,
};

const shareCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  borderRadius: '24px',
  border: '1px solid rgba(255,255,255,0.05)',
  overflow: 'hidden',
  boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
};

const imageWrapper: React.CSSProperties = {
  position: 'relative',
  aspectRatio: '16/10',
  background: '#1a1a3e',
};

const image: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
};

const badge: React.CSSProperties = {
  position: 'absolute',
  top: '15px',
  right: '15px',
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  color: 'white',
  padding: '8px 16px',
  borderRadius: '25px',
  fontSize: '16px',
  fontWeight: 700,
  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
};

const content: React.CSSProperties = {
  padding: '30px',
};

const title: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: 800,
  color: 'white',
  marginBottom: '8px',
};

const type: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: '16px',
  marginBottom: '24px',
};

const descBox: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  borderRadius: '16px',
  padding: '20px',
  border: '1px solid rgba(255,255,255,0.05)',
  marginBottom: '16px',
};

const descTitle: React.CSSProperties = {
  fontWeight: 600,
  color: 'white',
  fontSize: '16px',
  marginBottom: '10px',
};

const descText: React.CSSProperties = {
  color: 'rgba(255,255,255,0.7)',
  lineHeight: 1.8,
  fontSize: '15px',
};

const notesBox: React.CSSProperties = {
  background: 'rgba(251, 191, 36, 0.1)',
  borderRadius: '16px',
  padding: '20px',
  border: '1px solid rgba(251, 191, 36, 0.2)',
  marginBottom: '24px',
};

const notesTitle: React.CSSProperties = {
  fontWeight: 600,
  color: '#fbbf24',
  fontSize: '16px',
  marginBottom: '10px',
};

const notesText: React.CSSProperties = {
  color: 'rgba(255,255,255,0.8)',
  lineHeight: 1.8,
  fontSize: '15px',
};

const actionBox: React.CSSProperties = {
  textAlign: 'center' as const,
};

const actionBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '14px 36px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  borderRadius: '30px',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '16px',
  boxShadow: '0 8px 30px rgba(102, 126, 234, 0.4)',
};

const brandBox: React.CSSProperties = {
  textAlign: 'center',
  marginTop: '30px',
};

const brandText: React.CSSProperties = {
  color: 'rgba(255,255,255,0.3)',
  fontSize: '14px',
};

const footer: React.CSSProperties = {
  textAlign: 'center' as const,
  padding: '30px',
  color: 'rgba(255,255,255,0.2)',
  fontSize: '13px',
};
