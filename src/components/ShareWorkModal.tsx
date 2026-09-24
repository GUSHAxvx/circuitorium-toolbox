'use client';

import { useEffect, useState } from 'react';
import QRCodeBox from '@/components/QRCodeBox';
import { getStore, type ProjectBundle } from '@/lib/store';
import { exportProjectToEcp } from '@/lib/ecp/io';
import { saveBlob } from '@/lib/saveFile';
import { buildEcpBytes, buildShareHtml, encodeWorkCode } from '@/lib/share/standalone';

interface Props {
  projectId: string;
  onClose: () => void;
}

const AUTHOR_KEY = 'author_name';

// 分享作品：一个 HTML 文件（双击就能看）+ 一串作品码（小作品可以做成二维码让学生扫）
export default function ShareWorkModal({ projectId, onClose }: Props) {
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [author, setAuthor] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [workCode, setWorkCode] = useState('');
  const [codeNote, setCodeNote] = useState('');

  useEffect(() => {
    (async () => {
      const store = getStore();
      setBundle(await store.getProject(projectId));
      const saved = await store.getSetting(AUTHOR_KEY);
      if (saved) setAuthor(saved);
    })().catch(() => undefined);
  }, [projectId]);

  const persistAuthor = async (value: string) => {
    setAuthor(value);
    await getStore().setSetting(AUTHOR_KEY, value);
  };

  const handleSharePage = async () => {
    if (!bundle) return;
    setBusy(true);
    setMsg('');
    try {
      const { bytes } = await buildEcpBytes(bundle, author);
      const { html, filename, embedded, warnings } = await buildShareHtml({ bundle, author, ecpBytes: bytes });
      const saved = await saveBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), filename);
      if (!saved.ok) { setMsg('已取消保存'); return; }
      setMsg(embedded
        ? `已生成 ${filename}（在 ${saved.where}），发给别人双击就能看，页面里点一下就能存到自己的工具箱`
        : `已生成 ${filename}（在 ${saved.where}）${warnings.length ? `（${warnings[0]}）` : ''}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '生成失败');
    } finally {
      setBusy(false);
    }
  };

  const handleWorkCode = async () => {
    if (!bundle) return;
    setBusy(true);
    setMsg('');
    try {
      const { bytes } = await buildEcpBytes(bundle, author);
      const { code, ok } = encodeWorkCode(bytes);
      if (!ok) {
        setWorkCode('');
        setCodeNote('这个作品有点大，装不进二维码。用上面的「分享页」或「作品文件」发给对方就行。');
      } else {
        setWorkCode(code);
        setCodeNote('让学生扫这个码（或把码复制给他），粘到工具箱的「作品码」里就能打开。');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async () => {
    setBusy(true);
    setMsg('');
    try {
      const { blob, filename, warnings } = await exportProjectToEcp(projectId, author);
      const saved = await saveBlob(blob, filename);
      if (!saved.ok) { setMsg('已取消保存'); return; }
      setMsg(`已保存 ${filename}（在 ${saved.where}）${warnings.length ? `（${warnings[0]}）` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  if (!bundle) return null;

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '9px', fontSize: '13px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', outline: 'none',
  };

  return (
    <div className="sw-overlay" onClick={onClose}>
      <div className="sw-modal" onClick={(e) => e.stopPropagation()}>
        <header className="sw-head">
          <div>
            <h2>分享《{bundle.project.name}》</h2>
            <p>三种方式随你挑 · 都是本地生成，不经过服务器</p>
          </div>
          <button className="sw-close" onClick={onClose} aria-label="关闭">✕</button>
        </header>

        <label className="sw-label">署名（会出现在分享页上，可留空）</label>
        <input style={fieldStyle} value={author} onChange={(e) => void persistAuthor(e.target.value)} placeholder="例如：肆 / 三年二班 张三" />

        <div className="sw-options">
          <section className="sw-card">
            <h3>分享页（推荐）</h3>
            <p>生成一个 HTML 文件。发给别人（微信/U盘/邮件）后<b>双击就能看</b>，不用装工具箱、不用联网；页面里点一下就能把作品存进自己的工具箱。</p>
            <button className="sw-btn sw-btn-primary" onClick={handleSharePage} disabled={busy}>生成分享页</button>
          </section>

          <section className="sw-card">
            <h3>作品码（二维码）</h3>
            <p>体量小的作品能压成一串码，投屏成二维码让学生扫；对方粘到工具箱的「作品码」里即可打开。</p>
            <button className="sw-btn sw-btn-soft" onClick={handleWorkCode} disabled={busy}>生成作品码</button>
            {workCode && (
              <div className="sw-code">
                <QRCodeBox text={workCode} size={124} />
                <textarea readOnly value={workCode} rows={3} style={{ ...fieldStyle, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', flex: '1 1 200px' }} />
              </div>
            )}
            {codeNote && <p className="sw-note">{codeNote}</p>}
          </section>

          <section className="sw-card">
            <h3>作品文件</h3>
            <p>一个 <code>.ecp</code> 文件，图片原样保留，适合大作品或要长期存档的场景。</p>
            <button className="sw-btn sw-btn-ghost" onClick={handleFile} disabled={busy}>保存作品文件</button>
          </section>
        </div>

        {msg && <p className="sw-msg">{msg}</p>}
        <p className="sw-foot-note">作品里不会带上你的识别设置、凭据等本机信息。</p>

        <style jsx global>{`
          .sw-overlay { position: fixed; inset: 0; z-index: 400; background: rgba(4,7,14,0.78); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 18px; }
          .sw-modal { width: min(760px, 100%); max-height: 90vh; overflow-y: auto; background: #0d1626; border: 1px solid rgba(120,150,255,0.18); border-radius: 16px; padding: 18px; box-shadow: 0 30px 70px rgba(0,0,0,0.55); }
          .sw-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
          .sw-head h2 { margin: 0 0 4px; font-size: 16px; font-weight: 800; color: #fff; }
          .sw-head p { margin: 0; font-size: 12.5px; color: rgba(255,255,255,0.45); }
          .sw-close { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; }
          .sw-label { display: block; font-size: 12px; color: rgba(255,255,255,0.5); margin: 6px 0 6px; }
          .sw-options { display: grid; gap: 12px; grid-template-columns: 1fr; margin-top: 16px; }
          @media (min-width: 720px) { .sw-options { grid-template-columns: repeat(3, 1fr); } }
          .sw-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; }
          .sw-card h3 { margin: 0 0 8px; font-size: 13.5px; font-weight: 700; color: #dbe4ff; }
          .sw-card p { margin: 0 0 12px; font-size: 12px; line-height: 1.75; color: rgba(255,255,255,0.5); flex: 1; }
          .sw-card code { font-size: 11.5px; color: #9db8ff; }
          .sw-btn { padding: 10px 14px; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
          .sw-btn:disabled { opacity: 0.55; cursor: default; }
          .sw-btn-primary { background: linear-gradient(135deg, #3b6bff, #4f7cff); color: #fff; }
          .sw-btn-soft { background: rgba(167,139,250,0.16); color: #d6c8ff; border-color: rgba(167,139,250,0.34); }
          .sw-btn-ghost { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.14); }
          .sw-code { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
          .sw-note { margin: 10px 0 0; font-size: 11.5px; line-height: 1.7; color: rgba(255,255,255,0.42); }
          .sw-msg { margin: 14px 0 0; font-size: 12.5px; color: #86efac; }
          .sw-foot-note { margin: 10px 0 0; font-size: 11.5px; color: rgba(255,255,255,0.35); }
        `}</style>
      </div>
    </div>
  );
}
