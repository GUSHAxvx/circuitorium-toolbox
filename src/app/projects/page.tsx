'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStoredUser, getToken, authHeaders } from '@/lib/client';
import useIsMobile from '@/hooks/useIsMobile';
import SiteHeader from '@/components/SiteHeader';
import { DIFFICULTY_LABEL, type ProjectDifficulty } from '@/lib/store/types';
import { pageStyle, bgGradient, gridBg } from '@/styles/theme';

interface Project {
  id: number;
  name: string;
  notes: string;
  difficulty?: string;
  component_count: number;
  created_at: string;
  updated_at: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newDifficulty, setNewDifficulty] = useState<ProjectDifficulty>('shikai');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<{ username: string } | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    setUser(getStoredUser());
    // 首页「+ 创建项目」跳转过来时，直接展开创建表单
    if (typeof window !== 'undefined' && window.location.search.includes('new=1')) {
      setShowCreate(true);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    if (!getToken()) return;

    try {
      const res = await fetch('/api/projects', {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setProjects(data.projects);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError('请输入项目名称');
      return;
    }
    setCreating(true);
    setError('');

    if (!getToken()) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ name: newName, notes: newNotes, difficulty: newDifficulty }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowCreate(false);
        setNewName('');
        setNewNotes('');
        setNewDifficulty('shikai');
        router.push(`/projects/${data.project.id}`);
      } else {
        setError(data.error || '创建失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除此项目？项目内的所有元器件也会被删除。')) return;

    const res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });

    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
  };

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>请先登录</p>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={bgGradient} />
      <div style={gridBg} />

      <SiteHeader />

      <main className="pjx-main" style={{ padding: isMobile ? '92px 16px 56px' : '104px 40px 72px' }}>
        {/* ===== 标题区 ===== */}
        <header className="pjx-hero">
          <div>
            <h1 className="pjx-title">我的项目</h1>
            <p className="pjx-sub">每件作品里放着元件清单、图文教程和图片 · 点开就能接着改</p>
          </div>
          {!showCreate && (
            <button className="pjx-btn pjx-btn-primary" onClick={() => setShowCreate(true)}>＋ 新建项目</button>
          )}
        </header>

        {error && <p className="pjx-error">{error}</p>}

        {/* ===== 新建表单 ===== */}
        {showCreate && (
          <section className="pjx-create">
            <h3>新建项目</h3>
            <input
              className="pjx-input"
              placeholder="项目名称，例如：循迹小车"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <textarea
              className="pjx-input"
              rows={3}
              placeholder="一句话说明这个项目做什么（选填）"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
            />
            <div className="pjx-diff">
              <span className="pjx-diff-label">难度</span>
              {(['shikai', 'bankai'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`pjx-diff-opt${newDifficulty === level ? ' pjx-diff-opt-on' : ''}`}
                  onClick={() => setNewDifficulty(level)}
                >
                  <strong>{DIFFICULTY_LABEL[level].name}</strong>
                  <span>{DIFFICULTY_LABEL[level].hint}</span>
                </button>
              ))}
            </div>
            <div className="pjx-create-row">
              <button className="pjx-btn pjx-btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? '创建中…' : '创建'}
              </button>
              <button className="pjx-btn pjx-btn-ghost" onClick={() => { setShowCreate(false); setError(''); }}>
                取消
              </button>
            </div>
          </section>
        )}

        {/* ===== 作品列表 ===== */}
        {loading ? (
          <p className="pjx-dim">加载中…</p>
        ) : projects.length === 0 ? (
          !showCreate && (
            <section className="pjx-empty">
              <p>还没有项目</p>
              <span>点右上角「＋ 新建项目」，或到「模板」里挑一个带教程的现成项目。</span>
            </section>
          )
        ) : (
          <div className="pjx-grid">
            {projects.map((project) => (
              <article key={project.id} className="pjx-card">
                <Link href={`/projects/${project.id}`} className="pjx-card-main">
                  <span className="pjx-tile">{project.name.slice(0, 1).toUpperCase()}</span>
                  <h3>{project.name}</h3>
                  <p className="pjx-notes">{project.notes || '还没有说明'}</p>
                  <p className="pjx-meta">
                    <span className={`pjx-diff-badge pjx-diff-${project.difficulty === 'bankai' ? 'bankai' : 'shikai'}`}>
                      {DIFFICULTY_LABEL[project.difficulty === 'bankai' ? 'bankai' : 'shikai'].name}
                    </span>
                    {project.component_count} 个元件 · 更新于 {project.updated_at.slice(0, 10)}
                  </p>
                </Link>
                <div className="pjx-card-foot">
                  <Link href={`/projects/${project.id}`} className="pjx-open">打开 →</Link>
                  <button className="pjx-del" onClick={(e) => handleDelete(project.id, e)}>删除</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <style jsx global>{`
        .pjx-main { max-width: 1200px; margin: 0 auto; position: relative; z-index: 1; }
        .pjx-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
        .pjx-title { margin: 0 0 6px; font-size: clamp(22px, 3.4vw, 30px); font-weight: 800; color: #fff; letter-spacing: -0.4px; }
        .pjx-sub { margin: 0; font-size: 13px; color: rgba(255,255,255,0.45); }
        .pjx-btn { border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); border-radius: 10px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .pjx-btn:hover { background: rgba(255,255,255,0.09); }
        .pjx-btn-primary { background: linear-gradient(135deg, #667eea 0%, #7c5cf0 100%); border-color: transparent; color: #fff; }
        .pjx-btn-primary:hover { filter: brightness(1.08); }
        .pjx-btn:disabled { opacity: 0.5; cursor: default; }
        .pjx-input { width: 100%; box-sizing: border-box; padding: 11px 13px; margin-bottom: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; color: #fff; font-size: 13.5px; outline: none; font-family: inherit; }
        .pjx-input:focus { border-color: rgba(102,126,234,0.55); }
        .pjx-diff { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .pjx-diff-label { font-size: 12.5px; color: rgba(255,255,255,0.45); }
        .pjx-diff-opt { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 14px; border-radius: 11px; cursor: pointer; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.75); font-family: inherit; text-align: left; }
        .pjx-diff-opt strong { font-size: 13px; color: #fff; }
        .pjx-diff-opt span { font-size: 11.5px; color: rgba(255,255,255,0.45); }
        .pjx-diff-opt-on { background: rgba(102,126,234,0.16); border-color: rgba(102,126,234,0.5); }
        .pjx-diff-badge { display: inline-block; margin-right: 8px; padding: 1px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 800; border: 1px solid transparent; }
        .pjx-diff-shikai { background: rgba(148,163,184,0.14); color: #cbd5e1; border-color: rgba(148,163,184,0.3); }
        .pjx-diff-bankai { background: rgba(251,191,36,0.14); color: #fcd34d; border-color: rgba(251,191,36,0.34); }
        .pjx-create { background: rgba(255,255,255,0.03); border: 1px solid rgba(102,126,234,0.3); border-radius: 16px; padding: 18px; margin-bottom: 18px; }
        .pjx-create h3 { margin: 0 0 12px; font-size: 15px; font-weight: 700; color: #fff; }
        .pjx-create-row { display: flex; gap: 10px; }
        .pjx-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr)); }
        .pjx-card { display: flex; flex-direction: column; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px; transition: all 0.2s; }
        .pjx-card:hover { border-color: rgba(102,126,234,0.45); background: rgba(102,126,234,0.06); transform: translateY(-2px); }
        .pjx-card-main { display: block; flex: 1; text-decoration: none; }
        .pjx-tile { display: inline-flex; width: 40px; height: 40px; align-items: center; justify-content: center; border-radius: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; font-weight: 800; font-size: 17px; margin-bottom: 12px; }
        .pjx-card h3 { margin: 0 0 6px; font-size: 16.5px; font-weight: 700; color: #fff; }
        .pjx-notes { margin: 0 0 10px; font-size: 12.5px; line-height: 1.6; color: rgba(255,255,255,0.45); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .pjx-meta { margin: 0; font-size: 11.5px; color: rgba(255,255,255,0.32); }
        .pjx-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
        .pjx-open { font-size: 12.5px; font-weight: 600; color: #8ea2ff; text-decoration: none; }
        .pjx-del { background: rgba(239,68,68,0.1); border: none; color: #ef4444; padding: 5px 11px; border-radius: 8px; cursor: pointer; font-size: 12px; }
        .pjx-del:hover { background: rgba(239,68,68,0.2); }
        .pjx-empty { border: 2px dashed rgba(102,126,234,0.25); border-radius: 16px; padding: 46px 20px; text-align: center; }
        .pjx-empty p { margin: 0 0 6px; font-size: 15px; font-weight: 700; color: rgba(255,255,255,0.8); }
        .pjx-empty span { font-size: 12.5px; color: rgba(255,255,255,0.4); }
        .pjx-dim { color: rgba(255,255,255,0.4); text-align: center; padding: 40px; }
        .pjx-error { margin: 0 0 12px; color: #ef4444; font-size: 13px; }
      `}</style>
    </div>
  );
}
