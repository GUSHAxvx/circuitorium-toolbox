'use client';

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { getStoredUser, clearAuth, getToken, authHeaders } from '@/lib/client';
import useIsMobile from '@/hooks/useIsMobile';
import { bgGradient, gridBg } from '@/styles/theme';
import type { User } from '@/lib/types';

interface ProjectItem {
  id: number;
  name: string;
  component_count: number;
  updated_at: string;
  is_shared?: number;
  cover_path?: string | null;
  type_tags?: string | null;
}

interface TemplateItem {
  id: number;
  name: string;
  emoji: string;
  difficulty: string;
  description: string;
  component_count: number;
}

interface CommunityProject {
  id: number;
  name: string;
  share_token: string;
  author_name: string;
  component_count: number;
  updated_at: string;
  cover_path?: string | null;
  type_tags?: string | null;
}

// ===== 工具函数 =====
const coverUrl = (path?: string | null) => (path ? path.replace('/uploads/', '/api/uploads/') : '');

const coverGradients = [
  'linear-gradient(135deg, #232a55 0%, #141733 100%)',
  'linear-gradient(135deg, #1d3448 0%, #121a33 100%)',
  'linear-gradient(135deg, #2c2450 0%, #161430 100%)',
  'linear-gradient(135deg, #1f3a44 0%, #121a2e 100%)',
];

const coverBg = (id: number) => coverGradients[Math.abs(id) % coverGradients.length];

const splitTags = (value?: string | null) => (value ? value.split('|').filter(Boolean) : []);

// SQLite 的 CURRENT_TIMESTAMP 是 UTC，需要补 Z 再换算
function formatTime(value?: string) {
  if (!value) return '';
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return value.slice(0, 10);
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [userProjects, setUserProjects] = useState<ProjectItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [communityProjects, setCommunityProjects] = useState<CommunityProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const isMobile = useIsMobile();

  const loadProjects = useCallback(async () => {
    if (!getToken()) {
      setLoadingProjects(false);
      return;
    }
    try {
      const res = await fetch('/api/projects', { headers: authHeaders() });
      const data = await res.json();
      if (res.ok && data.projects) setUserProjects(data.projects);
    } catch {
      // 忽略网络错误，页面继续渲染空状态
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
      loadProjects();
    } else {
      setLoadingProjects(false);
    }

    fetch('/api/templates')
      .then((res) => res.json())
      .then((data) => {
        if (data.templates) setTemplates(data.templates);
      })
      .catch(() => undefined)
      .finally(() => setLoadingTemplates(false));

    fetch('/api/community')
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) setCommunityProjects(data.projects);
      })
      .catch(() => undefined)
      .finally(() => setLoadingCommunity(false));
  }, [loadProjects]);

  const handleLogout = () => {
    clearAuth();
    setUser(null);
  };

  // ===== 样式常量 =====
  const ctaPrimary: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? '14px 26px' : '15px 34px',
    background: 'linear-gradient(135deg, #667eea 0%, #7c5cf0 100%)',
    color: 'white',
    borderRadius: '14px',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: isMobile ? '15px' : '15.5px',
    boxShadow: '0 10px 28px rgba(102, 126, 234, 0.32)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  };

  const ctaGhost: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? '14px 26px' : '15px 34px',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.92)',
    borderRadius: '14px',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: isMobile ? '15px' : '15.5px',
    border: '1px solid rgba(255,255,255,0.14)',
    transition: 'border-color 0.2s, background 0.2s',
  };

  const overline: CSSProperties = {
    fontSize: '11px',
    letterSpacing: '2.5px',
    color: '#7c85b8',
    fontWeight: 700,
    margin: '0 0 6px',
    textTransform: 'uppercase',
  };

  const sectionTitle: CSSProperties = {
    color: 'white',
    fontWeight: 800,
    fontSize: isMobile ? '21px' : '26px',
    margin: 0,
    letterSpacing: '-0.2px',
  };

  const moreLink: CSSProperties = {
    color: 'rgba(255,255,255,0.55)',
    textDecoration: 'none',
    fontSize: isMobile ? '13px' : '14px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  const cardShell: CSSProperties = {
    background: 'linear-gradient(160deg, rgba(20,22,48,0.72) 0%, rgba(12,13,30,0.85) 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
    overflow: 'hidden',
    textDecoration: 'none',
    display: 'block',
    transition: 'transform 0.22s, border-color 0.22s',
  };

  const coverPattern: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(124, 138, 255, 0.07) 1px, transparent 1px),
      linear-gradient(90deg, rgba(124, 138, 255, 0.07) 1px, transparent 1px)
    `,
    backgroundSize: '22px 22px',
  };

  const tagStyle: CSSProperties = {
    padding: '3px 9px',
    borderRadius: '6px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.62)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.07)',
    whiteSpace: 'nowrap',
  };

  const skeletonStyle: CSSProperties = {
    height: '196px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.05)',
  };

  const heroBoard = (
    <svg viewBox="0 0 340 340" style={{ width: '100%', maxWidth: '330px', height: 'auto' }} aria-hidden="true">
      <defs>
        <radialGradient id="boardGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#667eea" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#667eea" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="traceActive" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#667eea" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <ellipse cx="170" cy="170" rx="155" ry="155" fill="url(#boardGlow)" />
      <rect x="30" y="30" width="280" height="280" rx="26" fill="#11132c" stroke="rgba(124,138,255,0.22)" strokeWidth="1.5" />
      {[
        'M60 100 H138', 'M202 100 H280', 'M60 240 H138', 'M202 240 H280',
        'M100 60 V138', 'M240 60 V138', 'M100 202 V280', 'M240 202 V280',
      ].map((d) => (
        <path key={d} d={d} stroke="rgba(124,138,255,0.28)" strokeWidth="1.5" strokeDasharray="6 7" fill="none" />
      ))}
      {[
        'M100 100 H156 V166', 'M184 166 H240 V100', 'M100 240 H156 V204', 'M184 204 H240 V240',
      ].map((d) => (
        <path key={d} d={d} stroke="url(#traceActive)" strokeWidth="2" fill="none" strokeDasharray="6 8" className="traceFlow" opacity="0.75" />
      ))}
      {[[100, 100], [240, 100], [100, 240], [240, 240]].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r="7" fill="#0a0a18" stroke="#22d3ee" strokeWidth="2" />
          <circle cx={cx} cy={cy} r="3" fill="#22d3ee" />
        </g>
      ))}
      <rect x="132" y="132" width="76" height="76" rx="10" fill="#1a1a3e" stroke="rgba(167,139,250,0.5)" strokeWidth="1.5" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={`t${i}`} x={146 + i * 16} y={124} width="8" height="8" rx="1.5" fill="#2b2b55" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <rect key={`b${i}`} x={146 + i * 16} y={208} width="8" height="8" rx="1.5" fill="#2b2b55" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <rect key={`l${i}`} x={124} y={146 + i * 16} width="8" height="8" rx="1.5" fill="#2b2b55" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <rect key={`r${i}`} x={208} y={146 + i * 16} width="8" height="8" rx="1.5" fill="#2b2b55" />
      ))}
      <text x="170" y="180" textAnchor="middle" fontSize="30">🔬</text>
    </svg>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a18',
      position: 'relative',
      overflowX: 'hidden',
      minWidth: '320px',
    }}>
      <div style={bgGradient} />
      <div style={gridBg} />
      {/* 顶部静态光晕（替代原先跟随鼠标的动效，更克制） */}
      <div style={{
        position: 'absolute',
        top: '-180px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '900px',
        height: '520px',
        background: 'radial-gradient(ellipse at center, rgba(102,126,234,0.14) 0%, transparent 68%)',
        pointerEvents: 'none',
      }} />

      <SiteHeader right={
        user ? (
          <>
            <Link href="/favorites" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>收藏</Link>
            <Link href="/history" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>历史</Link>
            {!isMobile && (
              <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '13px', flexShrink: 0 }}>{user.username}</span>
            )}
            <button onClick={handleLogout} style={{
              background: 'rgba(239,68,68,0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.25)',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}>退出</button>
          </>
        ) : (
          <>
            <Link href="/login" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '14px', fontWeight: 600, flexShrink: 0 }}>登录</Link>
            <Link href="/register" style={{
              background: 'linear-gradient(135deg, #667eea 0%, #7c5cf0 100%)',
              color: 'white',
              padding: '7px 16px',
              borderRadius: '9px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '13px',
              boxShadow: '0 4px 16px rgba(102, 126, 234, 0.32)',
              flexShrink: 0,
            }}>注册</Link>
          </>
        )
      } />

      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: isMobile ? '96px 20px 56px' : '140px 40px 96px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* ===== Hero ===== */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.08fr 0.92fr',
          gap: isMobile ? '28px' : '48px',
          alignItems: 'center',
          marginBottom: isMobile ? '56px' : '96px',
          textAlign: isMobile ? 'center' : 'left',
        }}>
          <div>
            <span style={{
              display: 'inline-block',
              padding: '5px 13px',
              borderRadius: '20px',
              background: 'rgba(124,138,255,0.08)',
              border: '1px solid rgba(124,138,255,0.22)',
              color: '#a5b4fc',
              fontSize: '11.5px',
              letterSpacing: '1.5px',
              fontWeight: 600,
              marginBottom: '20px',
            }}>
              电子工程项目工作台
            </span>

            <h1 style={{
              fontSize: isMobile ? '32px' : '52px',
              fontWeight: 800,
              lineHeight: 1.24,
              color: 'white',
              margin: '0 0 18px',
              letterSpacing: '-0.5px',
            }}>
              从一个元器件，
              <br />
              到完成一个
              <span style={{
                background: 'linear-gradient(90deg, #667eea 0%, #a78bfa 50%, #22d3ee 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                项目
              </span>
            </h1>

            <p style={{
              fontSize: isMobile ? '14px' : '15.5px',
              color: 'rgba(255,255,255,0.58)',
              lineHeight: 1.8,
              margin: '0 0 30px',
              maxWidth: '460px',
              marginLeft: isMobile ? 'auto' : 0,
              marginRight: isMobile ? 'auto' : 0,
            }}>
              工具箱在本机（断网也能用，带元件库和作品文件）· 项目与社区在服务器（多人共享）
            </p>

            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              justifyContent: isMobile ? 'center' : 'flex-start',
            }}>
              <Link
                href="/toolbox"
                style={ctaPrimary}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                打开工具箱 →
              </Link>
              <Link
                href={user ? '/projects?new=1' : '/login'}
                style={ctaGhost}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(124,138,255,0.42)'; e.currentTarget.style.background = 'rgba(124,138,255,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              >
                + 创建项目
              </Link>
              <Link
                href="/recognize"
                style={ctaGhost}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(124,138,255,0.42)'; e.currentTarget.style.background = 'rgba(124,138,255,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              >
                AI识别元器件
              </Link>
            </div>

            {!user && (
              <p style={{ marginTop: '18px', fontSize: '12.5px', color: 'rgba(255,255,255,0.38)' }}>
                课程演示？<Link href="/login" style={{ color: '#8b93c7', textDecoration: 'none', fontWeight: 600 }}>使用演示账号一键进入 →</Link>
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {heroBoard}
          </div>
        </section>

        {/* ===== 我的项目 ===== */}
        <section style={{ marginBottom: isMobile ? '56px' : '88px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', marginBottom: '18px' }}>
            <div>
              <p style={overline}>MY PROJECTS</p>
              <h2 style={sectionTitle}>我的项目</h2>
            </div>
            {user && <Link href="/projects" style={moreLink}>查看全部 →</Link>}
          </div>

          {loadingProjects && user ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '16px' }}>
              {[0, 1, 2].map((i) => <div key={i} style={skeletonStyle} />)}
            </div>
          ) : user && userProjects.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '16px' }}>
              {userProjects.slice(0, 3).map((p, index) => {
                const tags = splitTags(p.type_tags);
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    style={index === 0 ? { ...cardShell, borderColor: 'rgba(102,126,234,0.34)' } : cardShell}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(102,126,234,0.45)'; }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = index === 0 ? 'rgba(102,126,234,0.34)' : 'rgba(255,255,255,0.06)';
                    }}
                  >
                    <div style={{ position: 'relative', aspectRatio: '16 / 10', background: coverBg(p.id) }}>
                      <div style={coverPattern} />
                      {p.cover_path ? (
                        // eslint-disable-next-line @next/next/no-img-element -- 上传图片由 /api/uploads 提供，无需 next/image 优化
                        <img
                          src={coverUrl(p.cover_path)}
                          alt={`${p.name} 的图片`}
                          style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          fontSize: '30px',
                          fontWeight: 800,
                          color: 'rgba(255,255,255,0.14)',
                          letterSpacing: '1px',
                        }}>
                          {p.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      {index === 0 && (
                        <span style={{
                          position: 'absolute',
                          left: '12px',
                          top: '12px',
                          padding: '3px 9px',
                          borderRadius: '7px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#c7d2fe',
                          background: 'rgba(12,14,32,0.82)',
                          border: '1px solid rgba(102,126,234,0.45)',
                        }}>
                          继续 →
                        </span>
                      )}
                      {Boolean(p.is_shared) && (
                        <span style={{
                          position: 'absolute',
                          right: '12px',
                          top: '12px',
                          padding: '3px 9px',
                          borderRadius: '7px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#6ee7b7',
                          background: 'rgba(12,14,32,0.82)',
                          border: '1px solid rgba(52,211,153,0.35)',
                        }}>
                          已分享
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '14px 16px 16px' }}>
                      <p style={{
                        fontSize: '15.5px',
                        fontWeight: 700,
                        color: 'white',
                        margin: '0 0 8px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {p.name}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.42)' }}>
                          {formatTime(p.updated_at)}
                        </span>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.24)' }}>·</span>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.42)' }}>
                          {p.component_count} 个元器件
                        </span>
                        {tags.map((t) => <span key={t} style={tagStyle}>{t}</span>)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div style={{
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: '16px',
              padding: isMobile ? '28px 20px' : '36px 32px',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.015)',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '15px', fontWeight: 600, margin: '0 0 8px' }}>
                {user ? '还没有项目' : '登录后即可创建并管理你的项目'}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 20px' }}>
                {user ? '从一个模板开始，或新建一个空白项目自己搭。' : '识别元器件、整理 BOM、分享作品都在这里。'}
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {user ? (
                  <>
                    <Link href="/templates" style={{ ...ctaPrimary, padding: '11px 22px', fontSize: '14px', boxShadow: 'none' }}>从模板开始</Link>
                    <Link href="/projects?new=1" style={{ ...ctaGhost, padding: '11px 22px', fontSize: '14px' }}>新建空白项目</Link>
                  </>
                ) : (
                  <>
                    <Link href="/login" style={{ ...ctaPrimary, padding: '11px 22px', fontSize: '14px', boxShadow: 'none' }}>登录</Link>
                    <Link href="/register" style={{ ...ctaGhost, padding: '11px 22px', fontSize: '14px' }}>注册账号</Link>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ===== 社区项目 ===== */}
        <section style={{ marginBottom: isMobile ? '56px' : '88px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', marginBottom: '18px' }}>
            <div>
              <p style={overline}>COMMUNITY</p>
              <h2 style={sectionTitle}>社区项目</h2>
            </div>
            <Link href="/community" style={moreLink}>查看更多 →</Link>
          </div>

          {loadingCommunity ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(min(230px, 100%), 1fr))', gap: '16px' }}>
              {[0, 1, 2, 3].map((i) => <div key={i} style={{ ...skeletonStyle, height: '180px' }} />)}
            </div>
          ) : communityProjects.length === 0 ? (
            <div style={{
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: '14px',
              padding: isMobile ? '22px 18px' : '26px 24px',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.015)',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13.5px', margin: 0, lineHeight: 1.8 }}>
                社区里还没有公开的项目。把你的项目分享出去，它就会出现在这里。
              </p>
            </div>
          ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(min(230px, 100%), 1fr))', gap: '16px' }}>
                {communityProjects.slice(0, 4).map((p) => {
                  const tags = splitTags(p.type_tags);
                  return (
                    <Link
                      key={p.id}
                      href={`/share-project/${p.share_token}`}
                      style={cardShell}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.34)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                    >
                      <div style={{ position: 'relative', aspectRatio: '16 / 10', background: coverBg(p.id + 2) }}>
                        <div style={coverPattern} />
                        {p.cover_path ? (
                          // eslint-disable-next-line @next/next/no-img-element -- 上传图片由 /api/uploads 提供，无需 next/image 优化
                          <img
                            src={coverUrl(p.cover_path)}
                            alt={`${p.name} 的图片`}
                            style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            fontSize: '26px',
                            fontWeight: 800,
                            color: 'rgba(255,255,255,0.14)',
                          }}>
                            {p.name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div style={{ padding: '13px 15px 15px' }}>
                        <p style={{
                          fontSize: '14.5px',
                          fontWeight: 700,
                          color: 'white',
                          margin: '0 0 10px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {p.name}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: tags.length ? '10px' : 0 }}>
                          <span style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #34d399, #059669)',
                            color: '#04140e',
                            fontSize: '11px',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {(p.author_name || '?').slice(0, 1).toUpperCase()}
                          </span>
                          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.author_name}
                          </span>
                        </div>
                        {tags.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {tags.map((t) => <span key={t} style={tagStyle}>{t}</span>)}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
          )}
        </section>

        {/* ===== 项目模板（轻量入口） ===== */}
        <section style={{ marginBottom: isMobile ? '48px' : '72px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', marginBottom: '14px' }}>
              <h2 style={{ ...sectionTitle, fontSize: isMobile ? '17px' : '19px', color: 'rgba(255,255,255,0.9)' }}>
                项目模板
              </h2>
              <Link href="/templates" style={moreLink}>全部模板 →</Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: '12px' }}>
              {loadingTemplates
                ? [0, 1, 2].map((i) => <div key={i} style={{ ...skeletonStyle, height: '92px' }} />)
                : templates.slice(0, 3).map((t) => (
                  <Link
                    key={t.id}
                    href={user ? `/templates/${t.id}` : '/templates'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '13px',
                      padding: '15px 16px',
                      borderRadius: '13px',
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      textDecoration: 'none',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.32)'; e.currentTarget.style.background = 'rgba(167,139,250,0.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                  >
                    <span style={{ fontSize: '24px', lineHeight: 1, flexShrink: 0 }} aria-hidden="true">{t.emoji}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: '14.5px', fontWeight: 700, color: 'white', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name}
                      </p>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                        {t.difficulty} · {t.component_count} 种元器件 · 图文教程
                      </p>
                    </div>
                  </Link>
                ))}
            </div>
        </section>

        {/* ===== 两个轻量入口 ===== */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '12px',
          paddingTop: isMobile ? '0' : '8px',
        }}>
          {[
            { href: '/recognize', title: 'AI 识别元器件', desc: '上传图片，自动生成型号 / 封装 / 规格档案' },
            { href: '/history', title: '我的元件档案', desc: '识别历史与收藏，随时翻查已认过的元件' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                padding: isMobile ? '16px 18px' : '18px 22px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                textDecoration: 'none',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(102,126,234,0.35)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
            >
              <span>
                <span style={{ display: 'block', fontSize: '14.5px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{item.title}</span>
                <span style={{ display: 'block', fontSize: '12.5px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.6 }}>{item.desc}</span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px', flexShrink: 0 }}>→</span>
            </Link>
          ))}
        </section>
      </main>

      {/* ===== 页脚 ===== */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.012)',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: isMobile ? '32px 20px' : '44px 40px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr 1fr',
          gap: isMobile ? '24px' : '40px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
              }}>🔬</div>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'white', letterSpacing: '1px' }}>CIRCUITORIUM</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', lineHeight: 1.8, margin: 0, maxWidth: '300px' }}>
              从认识一个元件，到完成一个项目。让电子知识不再碎片化。
            </p>
          </div>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12.5px', fontWeight: 700, margin: '0 0 12px', letterSpacing: '1px' }}>快速链接</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {[['/projects', '我的项目'], ['/community', '社区项目'], ['/templates', '项目模板'], ['/recognize', 'AI识别']].map(([href, label]) => (
                <Link key={href} href={href} style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none', fontSize: '13px' }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12.5px', fontWeight: 700, margin: '0 0 12px', letterSpacing: '1px' }}>核心能力</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {['AI 元器件识别', '图文项目教程', 'BOM 备料管理', '项目分享与克隆'].map((label) => (
                <span key={label} style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>{label}</span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '14px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.24)' }}>
          © 2026 CIRCUITORIUM — 让电子知识不再碎片化
        </div>
      </footer>

      <style jsx global>{`
        @keyframes traceFlow {
          to { stroke-dashoffset: -84; }
        }
        .traceFlow {
          animation: traceFlow 4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .traceFlow { animation: none; }
        }
      `}</style>
    </div>
  );
}
