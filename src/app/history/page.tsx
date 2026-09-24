'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredUser, authHeaders, clearAuth } from '@/lib/client';
import type { HistoryItem } from '@/lib/types';
import SiteHeader from '@/components/SiteHeader';
import {
  pageStyle, bgGradient, gridBg, loadingStyle, footer,
  grid, card, cardImageWrapper, cardImage, cardBadge, cardContent,
  cardTitle, cardType, cardDesc, emptyState,
} from '@/styles/theme';

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    fetchHistory();
  }, [router]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history', {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setHistory(data.history);
      } else {
        setError(data.error || '获取历史失败');
      }
    } catch (err) {
      console.error('获取历史失败:', err);
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这条记录吗？')) return;
    try {
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: authHeaders(true),
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setHistory(history.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.push('/');
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={loadingStyle}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={bgGradient} />
      <div style={gridBg} />

      <SiteHeader right={
        <button onClick={handleLogout} style={{
          background: 'rgba(239,68,68,0.12)', color: '#ef4444',
          border: '1px solid rgba(239,68,68,0.25)', padding: '6px 14px',
          borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
        }}>退出</button>
      } />

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(96px, 13vh, 120px) clamp(16px, 5vw, 40px) 60px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={pageTitle}>📋 识别历史</h1>
          <Link href="/" style={primaryBtn}>继续识别 →</Link>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '14px 20px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>
        )}

        {history.length === 0 ? (
          <div style={emptyState}>
            <span style={{ fontSize: '60px', marginBottom: '20px', display: 'block' }}>📋</span>
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>暂无识别记录</p>
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>开始识别电子元器件吧</p>
            <Link href="/" style={primaryBtn}>开始识别 →</Link>
          </div>
        ) : (
          <div style={grid}>
            {history.map((item) => (
              <div key={item.id} style={card}>
                <div style={cardImageWrapper}>
                  <img src={item.image_path} alt="识别图片" style={cardImage} loading="lazy" />
                  <div style={cardBadge}>{(item.confidence * 100).toFixed(0)}%</div>
                </div>
                <div style={cardContent}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h3 style={cardTitle}>{item.component_name}</h3>
                      <p style={cardType}>{item.component_type}</p>
                    </div>
                  </div>
                  <p style={cardDesc}>{item.description}</p>
                  <p style={cardDate}>{new Date(item.created_at).toLocaleString('zh-CN')}</p>
                  <button onClick={() => handleDelete(item.id)} style={deleteBtn}>🗑️ 删除记录</button>
                </div>
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

// 以下共享样式见 @/styles/theme：pageStyle、bgGradient、gridBg、loadingStyle、headerStyle、logoStyle、logoText、navLink、footer、emptyState、grid、card、cardImageWrapper、cardImage、cardBadge、cardContent、cardTitle、cardType、cardDesc

const primaryBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 24px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  borderRadius: '25px',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '14px',
};

const pageTitle: React.CSSProperties = {
  fontSize: '36px',
  fontWeight: 700,
  color: 'white',
};

const cardDate: React.CSSProperties = {
  color: 'rgba(255,255,255,0.3)',
  fontSize: '12px',
  marginBottom: '12px',
};

const deleteBtn: React.CSSProperties = {
  color: '#ef4444',
  background: 'none',
  border: 'none',
  fontSize: '13px',
  cursor: 'pointer',
  padding: 0,
};
