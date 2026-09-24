'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredUser, authHeaders, clearAuth } from '@/lib/client';
import type { Favorite } from '@/lib/types';
import SiteHeader from '@/components/SiteHeader';
import {
  pageStyle, bgGradient, gridBg, loadingStyle, footer,
  grid, card, cardImageWrapper, cardImage, cardBadge, cardContent,
  cardTitle, cardType, cardDesc, emptyState,
} from '@/styles/theme';

// 复制文本到剪贴板，非 HTTPS 等场景下自动降级
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ component_name: '', component_type: '', description: '', notes: '' });
  const [shareMsg, setShareMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    fetchFavorites();
  }, [router]);

  const fetchFavorites = async () => {
    try {
      const res = await fetch('/api/favorites', {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setFavorites(data.favorites);
      } else {
        setError(data.error || '获取收藏失败');
      }
    } catch (err) {
      console.error('获取收藏失败:', err);
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这条收藏吗？')) return;
    try {
      const res = await fetch('/api/favorites', {
        method: 'DELETE',
        headers: authHeaders(true),
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setFavorites(favorites.filter(f => f.id !== id));
      }
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const startEdit = (item: Favorite) => {
    setEditingId(item.id);
    setEditForm({
      component_name: item.component_name,
      component_type: item.component_type,
      description: item.description,
      notes: item.notes || '',
    });
  };

  const saveEdit = async (id: number) => {
    try {
      const res = await fetch('/api/favorites', {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({ id, ...editForm }),
      });
      if (res.ok) {
        setFavorites(favorites.map(f => f.id === id ? { ...f, ...editForm } : f));
        setEditingId(null);
      }
    } catch (err) {
      console.error('更新失败:', err);
    }
  };

  const handleShare = async (id: number) => {
    try {
      const res = await fetch('/api/favorites/share', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ favorite_id: id }),
      });
      const data = await res.json();
      if (res.ok) {
        const shareUrl = window.location.origin + data.share_url;
        const copied = await copyToClipboard(shareUrl);
        setShareMsg(copied ? '分享链接已复制到剪贴板！' : `复制失败，请手动复制链接：${shareUrl}`);
        setTimeout(() => setShareMsg(''), 3000);
      } else {
        setShareMsg(data.error || '分享失败');
      }
    } catch (err) {
      console.error('分享失败:', err);
      setShareMsg('分享失败');
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
      {/* 背景 */}
      <div style={bgGradient} />
      <div style={gridBg} />

      {/* 导航 */}
      <SiteHeader right={
        <button onClick={handleLogout} style={{
          background: 'rgba(239,68,68,0.12)', color: '#ef4444',
          border: '1px solid rgba(239,68,68,0.25)', padding: '6px 14px',
          borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
        }}>退出</button>
      } />

      {/* 内容 */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(96px, 13vh, 120px) clamp(16px, 5vw, 40px) 60px', position: 'relative', zIndex: 1 }}>
        <h1 style={pageTitle}>⭐ 我的收藏</h1>

        {shareMsg && (
          <div style={successMsg}>{shareMsg}</div>
        )}

        {error && (
          <div style={{ ...successMsg, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>
        )}

        {favorites.length === 0 ? (
          <div style={emptyState}>
            <span style={{ fontSize: '60px', marginBottom: '20px', display: 'block' }}>⭐</span>
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>暂无收藏</p>
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>识别元器件后可添加收藏</p>
            <Link href="/" style={primaryBtn}>开始识别 →</Link>
          </div>
        ) : (
          <div style={grid}>
            {favorites.map((item) => (
              <div key={item.id} style={card}>
                <div style={cardImageWrapper}>
                  <img src={item.image_path} alt={item.component_name} style={cardImage} loading="lazy" />
                  <div style={cardBadge}>{(item.confidence * 100).toFixed(0)}%</div>
                </div>
                
                <div style={cardContent}>
                  {editingId === item.id ? (
                    <div style={editFormStyle}>
                      <input type="text" value={editForm.component_name} onChange={e => setEditForm({...editForm, component_name: e.target.value})} style={inputStyle} placeholder="元器件名称" />
                      <input type="text" value={editForm.component_type} onChange={e => setEditForm({...editForm, component_type: e.target.value})} style={inputStyle} placeholder="类型" />
                      <textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} style={{...inputStyle, minHeight: '60px'}} placeholder="描述" />
                      <textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} style={{...inputStyle, minHeight: '60px'}} placeholder="备注" />
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => saveEdit(item.id)} style={saveBtn}>保存</button>
                        <button onClick={() => setEditingId(null)} style={cancelBtn}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <h3 style={cardTitle}>{item.component_name}</h3>
                          <p style={cardType}>{item.component_type}</p>
                        </div>
                      </div>
                      <p style={cardDesc}>{item.description}</p>
                      {item.notes && (
                        <div style={notesStyle}>📝 {item.notes}</div>
                      )}
                      <div style={cardActions}>
                        <button onClick={() => startEdit(item)} style={actionBtn}>✏️ 更正</button>
                        <button onClick={() => handleShare(item.id)} style={actionBtn}>📤 分享</button>
                        <button onClick={() => handleDelete(item.id)} style={{...actionBtn, color: '#ef4444', background: 'rgba(239,68,68,0.1)'}}>🗑️</button>
                      </div>
                    </>
                  )}
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

const pageTitle: React.CSSProperties = {
  fontSize: '36px',
  fontWeight: 700,
  color: 'white',
  marginBottom: '30px',
};

const successMsg: React.CSSProperties = {
  background: 'rgba(16, 185, 129, 0.1)',
  color: '#10b981',
  padding: '14px 20px',
  borderRadius: '12px',
  marginBottom: '20px',
  textAlign: 'center' as const,
  border: '1px solid rgba(16, 185, 129, 0.2)',
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '20px',
  padding: '12px 30px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  borderRadius: '25px',
  textDecoration: 'none',
  fontWeight: 600,
};

const notesStyle: React.CSSProperties = {
  background: 'rgba(251, 191, 36, 0.1)',
  color: '#fbbf24',
  padding: '10px 12px',
  borderRadius: '10px',
  fontSize: '13px',
  marginBottom: '12px',
};

const cardActions: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
};

const actionBtn: React.CSSProperties = {
  flex: 1,
  padding: '10px',
  background: 'rgba(102,126,234,0.1)',
  color: '#a5b4fc',
  border: '1px solid rgba(102,126,234,0.2)',
  borderRadius: '10px',
  fontSize: '13px',
  cursor: 'pointer',
  transition: 'all 0.3s',
};

const editFormStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '10px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: 'white',
  fontSize: '14px',
  outline: 'none',
};

const saveBtn: React.CSSProperties = {
  flex: 1,
  padding: '10px',
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
};

const cancelBtn: React.CSSProperties = {
  flex: 1,
  padding: '10px',
  background: 'rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.7)',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
};
