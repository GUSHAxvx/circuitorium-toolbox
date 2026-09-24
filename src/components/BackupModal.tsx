'use client';

import { useRef, useState } from 'react';
import { createToolboxBackup, restoreToolboxBackup } from '@/lib/backup';
import { formatBytes } from '@/lib/images';
import { saveBlob } from '@/lib/saveFile';

interface Props {
  onClose: () => void;
  onRestored: () => void;
}

// 工具箱备份：换电脑 / 清理浏览器之前先存一份，一键找回全部作品
export default function BackupModal({ onClose, onRestored }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await createToolboxBackup();
      if (res.projectCount === 0) {
        setErr('这台电脑上还没有作品，先做一个再备份吧');
        return;
      }
      const saved = await saveBlob(res.blob, res.filename);
      if (!saved.ok) { setErr('好，那就不存了'); return; }
      setMsg(`存好了：${res.filename}（${res.projectCount} 件作品，${formatBytes(res.bytes)}），在 ${saved.where}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '备份失败');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await restoreToolboxBackup(file);
      setMsg(`已找回 ${res.restored} 件作品${res.skipped ? `（${res.skipped} 件跳过）` : ''}`);
      if (res.warnings.length) setErr(res.warnings[0]);
      onRestored();
    } catch (error) {
      setErr(error instanceof Error ? error.message : '恢复失败');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="bk-overlay" onClick={onClose}>
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <header className="bk-head">
          <div>
            <h2>备份与恢复</h2>
            <p>作品都在这台电脑上 · 换电脑或清理浏览器之前存一份</p>
          </div>
          <button className="bk-close" onClick={onClose} aria-label="关闭">✕</button>
        </header>

        <section className="bk-card">
          <h3>备份全部作品</h3>
          <p>把所有作品打成一个压缩包（每件作品一个文件，图片原样保留）。存在 U 盘、网盘或发给自己的另一台电脑都可以。</p>
          <button className="bk-btn bk-btn-primary" onClick={handleBackup} disabled={busy}>
            {busy ? '处理中…' : '生成备份'}
          </button>
        </section>

        <section className="bk-card">
          <h3>从备份恢复</h3>
          <p>选择之前生成的备份压缩包，作品会一件件回到工具箱里（不会覆盖现有作品，重复的会作为新的一件加进来）。</p>
          <label className="bk-btn bk-btn-soft" style={{ cursor: 'pointer' }}>
            选择备份文件
            <input ref={fileRef} type="file" accept=".zip,application/zip" style={{ display: 'none' }} onChange={handleRestore} disabled={busy} />
          </label>
        </section>

        {msg && <p className="bk-msg">{msg}</p>}
        {err && <p className="bk-err">{err}</p>}
        <p className="bk-note">备份里只有作品本身，不含任何识别凭据或本机设置。</p>

        <style jsx global>{`
          .bk-overlay { position: fixed; inset: 0; z-index: 400; background: rgba(4,7,14,0.78); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 18px; }
          .bk-modal { width: min(620px, 100%); max-height: 90vh; overflow-y: auto; background: #0d1626; border: 1px solid rgba(120,150,255,0.18); border-radius: 16px; padding: 18px; box-shadow: 0 30px 70px rgba(0,0,0,0.55); }
          .bk-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
          .bk-head h2 { margin: 0 0 4px; font-size: 16px; font-weight: 800; color: #fff; }
          .bk-head p { margin: 0; font-size: 12.5px; color: rgba(255,255,255,0.45); }
          .bk-close { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; }
          .bk-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
          .bk-card h3 { margin: 0 0 8px; font-size: 13.5px; font-weight: 700; color: #dbe4ff; }
          .bk-card p { margin: 0 0 12px; font-size: 12px; line-height: 1.75; color: rgba(255,255,255,0.5); }
          .bk-btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; border-radius: 9px; font-size: 13px; font-weight: 600; border: 1px solid transparent; cursor: pointer; }
          .bk-btn-primary { background: linear-gradient(135deg, #3b6bff, #4f7cff); color: #fff; }
          .bk-btn-primary:disabled { opacity: 0.55; cursor: default; }
          .bk-btn-soft { background: rgba(79,124,255,0.12); color: #bcd0ff; border-color: rgba(79,124,255,0.3); }
          .bk-msg { margin: 12px 0 0; font-size: 12.5px; color: #86efac; }
          .bk-err { margin: 12px 0 0; font-size: 12.5px; color: #fca5a5; }
          .bk-note { margin: 10px 0 0; font-size: 11.5px; color: rgba(255,255,255,0.35); }
        `}</style>
      </div>
    </div>
  );
}
