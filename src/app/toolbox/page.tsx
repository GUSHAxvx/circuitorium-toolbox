'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import ProjectDetailView from '@/components/ProjectDetailView';
import ShareWorkModal from '@/components/ShareWorkModal';
import LocalAiRecognize from '@/components/LocalAiRecognize';
import AiSettingsModal from '@/components/AiSettingsModal';
import BackupModal from '@/components/BackupModal';
import { getStore } from '@/lib/store';
import { importEcpToStore, exportProjectToEcp } from '@/lib/ecp/io';
import { saveBlob } from '@/lib/saveFile';
import { decodeWorkCode } from '@/lib/share/standalone';
import { describeAiMode, loadAiConfig, DEFAULT_AI_CONFIG, type AiConfig } from '@/lib/ai/config';
import type { ProjectSummary, ToolboxTemplate } from '@/lib/store';
import { bgGradient, gridBg } from '@/styles/theme';

// 本地工具箱：不登录、不联网、不需要 API Key 也能用
export default function ToolboxPage() {
  // 打开项目时在同一路由内切换视图：不发网络请求，断网也能用
  const [openId, setOpenId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [templates, setTemplates] = useState<ToolboxTemplate[]>([]);
  const [usage, setUsage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState('');
  const [workCodeInput, setWorkCodeInput] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiConfig>(DEFAULT_AI_CONFIG);
  const [shareFor, setShareFor] = useState<string | null>(null);
  const [recognizeFor, setRecognizeFor] = useState<string | null>(null);
  const [detailEpoch, setDetailEpoch] = useState(0);
  const openFileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const store = getStore();
    const [list, tpls, used] = await Promise.all([
      store.listProjects(),
      store.listTemplates(),
      store.estimateUsage(),
    ]);
    setProjects(list);
    setTemplates(tpls);
    setUsage(used);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : '这台电脑的本地存储打不开，换个浏览器试试');
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  // AI 配置（可选）：只读本机设置，不联网
  useEffect(() => {
    loadAiConfig().then(setAiConfig).catch(() => undefined);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const store = getStore();
      const id = await store.createProject({ name: newName });
      setNewName('');
      setShowCreate(false);
      await refresh();
      setOpenId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setBusy(false);
    }
  };

  const handleFromTemplate = async (templateId: string) => {
    setBusy(true);
    try {
      const store = getStore();
      const id = await store.instantiateTemplate(templateId);
      await refresh();
      setOpenId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await importEcpToStore(file);
      await refresh();
      setOpenId(res.projectId);
      setNotice(
        `收下了《${res.name}》${res.author ? ` · 作者：${res.author}` : ''} · 元件 ${res.counts.components} 个 · 教程 ${res.counts.sections} 节 · 图片 ${res.counts.images} 张`
        + (res.warnings.length ? `（${res.warnings[0]}）` : '')
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '这个文件打不开，可能没传完整——让对方再发一次吧');
    } finally {
      setBusy(false);
      if (openFileRef.current) openFileRef.current.value = '';
    }
  };

  const handleWorkCode = async () => {
    const bytes = decodeWorkCode(workCodeInput);
    if (!bytes) {
      setError('这串作品码没看明白——确认一下是以 CTW1- 开头、而且复制完整了');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await importEcpToStore(new Blob([bytes as unknown as BlobPart], { type: 'application/zip' }));
      await refresh();
      setOpenId(res.projectId);
      setWorkCodeInput('');
      setNotice(`收下了《${res.name}》${res.author ? ` · 作者：${res.author}` : ''} · 元件 ${res.counts.components} 个`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '这串作品码打不开，让发的人重新生成一次吧');
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    setBusy(true);
    try {
      await getStore().duplicateProject(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`删掉「${name}」？里面的元件、图片、教程会一起走，删了就找不回来了。`)) return;
    setBusy(true);
    try {
      await getStore().deleteProject(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  /** 保存作品文件（.ecp）：发给别人、换电脑、存档都用它 */
  const handleSaveFile = async (id: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { blob, filename, warnings } = await exportProjectToEcp(id);
      const saved = await saveBlob(blob, filename);
      if (!saved.ok) { setNotice('好，那就不存了'); return; }
      setNotice(warnings.length
        ? `作品文件已保存（${warnings[0]}）`
        : `存好了：${saved.where}。发给别人，双击就能打开`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  /** 做同款：复制一件到自己工具箱里改，原件不动 */
  const handleRemix = async (id: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const copyId = await getStore().duplicateProject(id);
      await refresh();
      setOpenId(copyId);
      setDetailEpoch((n) => n + 1);
      setNotice('已复制一件新的，可以放心改了（原件没有被动过）');
    } catch (e) {
      setError(e instanceof Error ? e.message : '复制失败');
    } finally {
      setBusy(false);
    }
  };

  /** 从详情页返回工具箱：释放图片地址，避免越开越多 */
  const backToList = () => {
    getStore().releaseImageUrls();
    setOpenId(null);
    setDetailEpoch((n) => n + 1);
    void refresh();
  };

  const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** 作品封面：有图片就显示图片，没有就显示渐变色 + 首字（本地图片是 blob 地址） */
function ProjectCover({ projectId, name, coverImageId }: { projectId: string; name: string; coverImageId: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!coverImageId) { setTried(true); return () => { alive = false; }; }
    getStore().imageUrl(coverImageId)
      .then((u) => { if (alive) { setUrl(u); setTried(true); } })
      .catch(() => { if (alive) setTried(true); });
    return () => { alive = false; };
  }, [projectId, coverImageId]);

  return (
    <span className="tb-cover">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- 本地图片用 blob 地址显示
        <img src={url} alt={`${name} 的图片`} />
      ) : (
        <>
          <span className="tb-cover-grid" />
          <span className="tb-cover-initial">{tried ? name.slice(0, 1).toUpperCase() : ''}</span>
        </>
      )}
    </span>
  );
}
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  // 打开作品时直接整页交给「作品详情页」：
  // 它自带页头与 1400px 的版心，不能再套在工具箱的 tb-main（1200px）里，
  // 否则版心被压窄、两层内边距叠加，看起来"尺寸很奇怪"。
  if (openId) {
    return (
      <>
        <ProjectDetailView
          key={`${openId}-${detailEpoch}`}
          projectId={openId}
          mode="local"
          onBack={backToList}
          extraActions={
            <>
              <button className="pj-btn pj-btn-primary" onClick={() => setShareFor(openId)}>分享作品</button>
              <button className="pj-btn pj-btn-ghost" onClick={() => void handleSaveFile(openId)} disabled={busy}>保存作品文件</button>
              <button className="pj-btn pj-btn-ghost" onClick={() => void handleRemix(openId)} disabled={busy}>做同款</button>
              <button className="pj-btn pj-btn-ghost" onClick={() => setRecognizeFor(openId)}>AI 识别元件</button>
            </>
          }
        />
        {(notice || error) && (
          <div className="pj-toast" style={error ? { borderColor: 'rgba(239,68,68,0.5)', color: '#fca5a5' } : undefined}>
            {error || notice}
          </div>
        )}
        {shareFor && <ShareWorkModal projectId={shareFor} onClose={() => setShareFor(null)} />}
        {recognizeFor && (
          <LocalAiRecognize
            projectId={recognizeFor}
            onClose={() => setRecognizeFor(null)}
            onAdded={() => { setDetailEpoch((n) => n + 1); void refresh(); }}
          />
        )}
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#070a14', position: 'relative', overflowX: 'hidden', minWidth: '320px' }}>
      <div style={bgGradient} />
      <div style={gridBg} />

      <SiteHeader
        homeHref="/toolbox"
        links={[{ href: '/toolbox', label: '工具箱' }]}
        right={
        <span style={{
          padding: '4px 10px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 700,
          background: 'rgba(34,197,94,0.12)', color: '#6ee7b7', border: '1px solid rgba(34,197,94,0.3)', flexShrink: 0,
        }}>
          本地模式
        </span>
      } />

      <main className="tb-main">
        <>
        <header className="tb-hero">
          <div>
            <h1 className="tb-title">我的工具箱</h1>
            <p className="tb-sub">
              数据保存在这台电脑上 · 不用登录 · 断网也能用 · 无需任何配置
            </p>
          </div>
          <div className="tb-actions">
            <button className="tb-btn tb-btn-ghost" onClick={() => setShowBackup(true)}>
              备份与恢复
            </button>
            <button className="tb-btn tb-btn-ghost" onClick={() => setShowAi(true)}>
              识别设置 · {describeAiMode(aiConfig)}
            </button>
            <label className="tb-btn tb-btn-ghost" style={{ cursor: 'pointer' }}>
              打开作品
              <input
                ref={openFileRef}
                type="file"
                accept=".ecp,application/zip"
                style={{ display: 'none' }}
                onChange={handleOpenFile}
                disabled={busy}
              />
            </label>
            <button className="tb-btn tb-btn-primary" onClick={() => setShowCreate((v) => !v)}>＋ 新建项目</button>
          </div>
        </header>

        <div className="tb-notice">
          <strong>东西都在你自己的电脑上</strong>
          <span>项目、元件、图片、教程一样都不上云；图片占了 {formatSize(usage)}。把这个文件夹拷给别人，对方解压就能用——不用装、不用联网。</span>
        </div>

        {notice && <div className="tb-ok">{notice}</div>}

        <div className="tb-code-row">
          <span className="tb-code-label">作品码</span>
          <input
            className="tb-input"
            value={workCodeInput}
            onChange={(e) => setWorkCodeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleWorkCode(); }}
            placeholder="把扫到的作品码（CTW1-…）粘到这里"
          />
          <button className="tb-btn tb-btn-ghost" onClick={handleWorkCode} disabled={busy || !workCodeInput.trim()}>打开</button>
        </div>

        {error && <div className="tb-error">{error}</div>}

        {showCreate && (
          <section className="tb-card">
            <p className="tb-card-title">新建项目</p>
            <div className="tb-row">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                placeholder="项目名称，例如：LED 呼吸灯"
                className="tb-input"
              />
              <button className="tb-btn tb-btn-primary" onClick={handleCreate} disabled={busy || !newName.trim()}>
                {busy ? '创建中…' : '创建'}
              </button>
              <button className="tb-btn tb-btn-ghost" onClick={() => { setShowCreate(false); setNewName(''); }}>取消</button>
            </div>
          </section>
        )}

        {loading ? (
          <p className="tb-loading">正在打开你的工具箱…</p>
        ) : (
          <>
            {/* 我的项目 */}
            <section>
              <div className="tb-section-head">
                <h2>我的作品 <span className="tb-count">{projects.length}</span></h2>
                {projects.some((p) => p.source?.type === 'sample') && (
                  <span className="tb-hint">带「示例作品」标记的，放心改、随便删——都是给你练手的</span>
                )}
              </div>
              {projects.length === 0 ? (
                <div className="tb-empty">
                  <p>还空着呢</p>
                  <span>点「＋ 新建项目」从零开始；或者从下面挑个模板——出来的作品自带元件清单和图文教程。</span>
                </div>
              ) : (
                <div className="tb-grid">
                  {projects.map((p) => (
                    <article key={p.id} className="tb-project">
                      <button className="tb-project-main" onClick={() => setOpenId(p.id)}>
                        {/* 作品墙封面：有图用图，没图用渐变色 + 首字 */}
                        <ProjectCover projectId={p.id} name={p.name} coverImageId={p.coverImageId} />
                        <h3>{p.name}</h3>
                        <p className="tb-project-notes">{p.notes || '还没写简介'}</p>
                        <p className="tb-project-meta">
                          {p.componentCount} 个元件 · {p.imageCount} 张图片 · {formatTime(p.updatedAt)}
                        </p>
                        <span className="tb-badges">
                          {p.source?.type === 'sample' && <span className="tb-badge tb-badge-green">示例作品</span>}
                          {p.source?.type === 'template' && <span className="tb-badge">来自模板</span>}
                          {p.source?.type === 'shared' && <span className="tb-badge tb-badge-blue">收到的作品</span>}
                        </span>
                      </button>
                      <div className="tb-project-actions">
                        <button className="tb-mini" onClick={() => handleDuplicate(p.id)} disabled={busy} title="复制一份到我的项目">做同款</button>
                        <button className="tb-mini tb-mini-danger" onClick={() => handleDelete(p.id, p.name)} disabled={busy}>删除</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* 内置模板 */}
            <section className="tb-section">
              <div className="tb-section-head">
                <h2>内置项目模板 <span className="tb-count">{templates.length}</span></h2>
                <span className="tb-hint">离线自带 · 每个都配好了元件清单和图文教程</span>
              </div>
              <div className="tb-grid">
                {templates.map((t) => (
                  <article key={t.id} className="tb-template">
                    <div className="tb-template-head">
                      <span className="tb-emoji" aria-hidden="true">{t.emoji}</span>
                      <div>
                        <h3>{t.name}</h3>
                        <p className="tb-project-meta">{t.difficulty} · {t.components.length} 种元件 · {t.sections.length} 节教程</p>
                      </div>
                    </div>
                    <p className="tb-project-notes">{t.description}</p>
                    <button className="tb-btn tb-btn-soft" onClick={() => handleFromTemplate(t.id)} disabled={busy}>
                      用这个模板建项目
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
        </>
      </main>

      <footer className="tb-footer">CIRCUITORIUM 工具箱 · 东西都在你手里</footer>

      {showAi && (
        <AiSettingsModal
          onClose={() => setShowAi(false)}
          onSaved={(cfg) => setAiConfig(cfg)}
        />
      )}

      {showBackup && (
        <BackupModal onClose={() => setShowBackup(false)} onRestored={refresh} />
      )}

      <style jsx global>{`
        .tb-main { max-width: 1200px; margin: 0 auto; padding: clamp(92px, 12vh, 128px) clamp(14px, 3.5vw, 40px) 72px; position: relative; z-index: 1; }
        .tb-hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .tb-title { margin: 0 0 8px; font-size: clamp(22px, 2.6vw, 32px); font-weight: 800; color: #fff; letter-spacing: -0.3px; }
        .tb-sub { margin: 0; color: rgba(255,255,255,0.5); font-size: 13.5px; }
        .tb-actions { display: flex; gap: 10px; }
        .tb-notice {
          display: flex; gap: 10px; flex-wrap: wrap; align-items: baseline;
          padding: 12px 15px; border-radius: 12px; margin-bottom: 22px;
          background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.2);
          font-size: 12.5px; color: rgba(255,255,255,0.6);
        }
        .tb-notice strong { color: #6ee7b7; font-size: 12.5px; }
        .tb-error { padding: 12px 15px; border-radius: 12px; margin-bottom: 18px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #fca5a5; font-size: 13px; }
        .tb-ok { padding: 12px 15px; border-radius: 12px; margin-bottom: 18px; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25); color: #86efac; font-size: 13px; }
        .tb-code-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 22px; }
        .tb-code-label { font-size: 12.5px; color: rgba(255,255,255,0.45); }
        .tb-loading { color: rgba(255,255,255,0.4); font-size: 13.5px; padding: 30px 0; text-align: center; }
        .tb-card { background: linear-gradient(165deg, rgba(17,25,45,0.9), rgba(10,15,28,0.92)); border: 1px solid rgba(120,150,255,0.12); border-radius: 14px; padding: 16px; margin-bottom: 22px; }
        .tb-card-title { margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #dbe4ff; }
        .tb-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .tb-input {
          flex: 1 1 260px; padding: 11px 14px; border-radius: 10px; font-size: 14px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: #fff; outline: none;
        }
        .tb-input:focus { border-color: rgba(120,150,255,0.45); }
        .tb-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 18px; border-radius: 10px; font-size: 13.5px; font-weight: 600;
          border: 1px solid transparent; cursor: pointer; white-space: nowrap;
        }
        .tb-btn-primary { background: linear-gradient(135deg, #3b6bff, #4f7cff); color: #fff; box-shadow: 0 8px 22px rgba(59,107,255,0.28); }
        .tb-btn-primary:disabled { opacity: 0.55; cursor: default; }
        .tb-btn-ghost { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.14); }
        .tb-btn-soft { width: 100%; margin-top: 12px; background: rgba(79,124,255,0.12); color: #bcd0ff; border-color: rgba(79,124,255,0.3); }
        .tb-btn-soft:hover { background: rgba(79,124,255,0.2); }
        .tb-section { margin-top: 30px; }
        .tb-section-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
        .tb-section-head h2 { margin: 0; font-size: 17px; font-weight: 800; color: #fff; }
        .tb-count { margin-left: 6px; font-size: 12px; font-weight: 700; color: #9db8ff; }
        .tb-hint { font-size: 12.5px; color: rgba(255,255,255,0.4); }
        .tb-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr)); }
        .tb-project, .tb-template {
          background: linear-gradient(165deg, rgba(17,25,45,0.9), rgba(10,15,28,0.92));
          border: 1px solid rgba(120,150,255,0.1); border-radius: 14px; padding: 15px;
          display: flex; flex-direction: column; justify-content: space-between; gap: 10px;
          transition: border-color 0.2s, transform 0.2s;
        }
        .tb-project:hover, .tb-template:hover { border-color: rgba(120,150,255,0.35); transform: translateY(-2px); }
        .tb-project-main { display: block; width: 100%; text-align: left; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; }
        .tb-cover { position: relative; aspect-ratio: 16 / 10; border-radius: 10px; overflow: hidden; margin-bottom: 11px;
          background: linear-gradient(150deg, #232a55 0%, #141733 100%); display: grid; place-items: center; }
        .tb-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .tb-cover-grid { position: absolute; inset: 0;
          background-image: linear-gradient(rgba(124,138,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(124,138,255,0.07) 1px, transparent 1px);
          background-size: 22px 22px; }
        .tb-cover-initial { position: relative; font-size: 44px; font-weight: 800; color: rgba(255,255,255,0.22); letter-spacing: 1px; }
        .tb-badges { display: flex; gap: 6px; flex-wrap: wrap; }
        .tb-badge-green { background: rgba(34,197,94,0.14); color: #6ee7b7; border-color: rgba(34,197,94,0.3); }
        .tb-project h3, .tb-template h3 { margin: 0 0 6px; font-size: 15px; font-weight: 700; color: #fff; }
        .tb-project-notes { margin: 0 0 8px; font-size: 12.5px; line-height: 1.7; color: rgba(255,255,255,0.5); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .tb-project-meta { margin: 0; font-size: 11.5px; color: rgba(255,255,255,0.38); }
        .tb-badge { display: inline-block; margin-top: 8px; padding: 2px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 700; background: rgba(167,139,250,0.14); color: #c4b5fd; border: 1px solid rgba(167,139,250,0.3); }
        .tb-badge-blue { background: rgba(79,124,255,0.14); color: #bcd0ff; border-color: rgba(79,124,255,0.3); }
        .tb-project-actions { display: flex; gap: 8px; }
        .tb-mini {
          flex: 1; padding: 7px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.75);
        }
        .tb-mini:hover { border-color: rgba(120,150,255,0.4); }
        .tb-mini-danger { color: #ef4444; border-color: rgba(239,68,68,0.24); background: rgba(239,68,68,0.08); }
        .tb-template-head { display: flex; align-items: center; gap: 11px; margin-bottom: 4px; }
        .tb-emoji { font-size: 26px; line-height: 1; }
        .tb-empty { border: 1px dashed rgba(255,255,255,0.14); border-radius: 14px; padding: 30px 20px; text-align: center; background: rgba(255,255,255,0.015); }
        .tb-empty p { margin: 0 0 6px; font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.75); }
        .tb-empty span { font-size: 12.5px; color: rgba(255,255,255,0.4); }
        .tb-footer { position: relative; z-index: 1; text-align: center; padding: 24px 20px; font-size: 12.5px; color: rgba(255,255,255,0.28); border-top: 1px solid rgba(255,255,255,0.05); }
      `}</style>
    </div>
  );
}
