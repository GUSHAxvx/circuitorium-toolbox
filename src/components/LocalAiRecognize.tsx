'use client';

// 本地模式的「AI 识别元件」（可选功能）
// 设计原则：没配置识别凭据时，这里只说清「怎么开」，绝不挡路——工具箱的其它功能照常使用。

import { useEffect, useRef, useState } from 'react';
import { getStore } from '@/lib/store';
import { isAiReady, loadAiConfig, type AiConfig } from '@/lib/ai/config';
import { AiError, recognizeImage } from '@/lib/ai/recognize';
import AiSettingsModal from '@/components/AiSettingsModal';

interface Props {
  projectId: string;
  onClose: () => void;
  /** 识别并写入本机后回调，用于刷新详情页 */
  onAdded?: (count: number) => void;
}

export default function LocalAiRecognize({ projectId, onClose, onAdded }: Props) {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [found, setFound] = useState<{ name: string; type: string; confidence: number }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAiConfig().then(setConfig).catch(() => undefined);
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const ready = !!config && isAiReady(config);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMsg('');
    setFound([]);
  };

  const handleRecognize = async () => {
    if (!config || !file) return;
    setBusy(true);
    setMsg('正在识别，请稍候…');
    try {
      const { components: list } = await recognizeImage(config, file);
      const store = getStore();
      for (const c of list) {
        await store.addComponent(projectId, {
          name: c.name,
          type: c.type,
          model: c.model,
          manufacturer: c.manufacturer,
          packageType: c.packageType,
          pinCount: c.pinCount,
          specifications: c.specifications,
          description: c.description,
          confidence: c.confidence,
        });
      }
      setFound(list.map((c) => ({ name: c.name, type: c.type || '', confidence: c.confidence || 0 })));
      setMsg(`识别完成，已加入 ${list.length} 个元件`);
      onAdded?.(list.length);
    } catch (err) {
      setMsg(err instanceof AiError ? err.message : '识别失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lr-overlay" onClick={onClose}>
      <div className="lr-modal" onClick={(e) => e.stopPropagation()}>
        <header className="lr-head">
          <div>
            <h2>AI 识别元件</h2>
            <p>可选功能 · 用照片自动认元件，认完可以直接改</p>
          </div>
          <button className="lr-close" onClick={onClose} aria-label="关闭">✕</button>
        </header>

        {config === null ? (
          <p className="lr-note">正在读取本机设置…</p>
        ) : !ready ? (
          <section className="lr-card">
            <h3>这台电脑还没配置识别凭据</h3>
            <p>
              不配置也完全没关系：上面的「＋ 添加元件」可以手动录入，工具箱其它功能都不受影响。
              想用 AI 识别，可以填老师发的配置码，或自己的识别凭据。
            </p>
            <button className="lr-btn lr-btn-primary" onClick={() => setShowSettings(true)}>去设置识别凭据</button>
          </section>
        ) : (
          <>
            <section className="lr-card">
              <h3>选一张元件照片</h3>
              <p>照片只在本机用于这一次识别，不会存进作品里。</p>
              <div className="lr-row">
                <label className="lr-btn lr-btn-primary" style={{ cursor: busy ? 'default' : 'pointer' }}>
                  {file ? '换一张' : '选择照片 / 拍照'}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handlePick}
                    disabled={busy}
                  />
                </label>
                <button className="lr-btn lr-btn-soft" onClick={handleRecognize} disabled={!file || busy}>
                  {busy ? '识别中…' : '开始识别'}
                </button>
              </div>
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element -- 本机照片临时预览
                <img className="lr-preview" src={preview} alt="待识别的照片" />
              )}
            </section>

            {found.length > 0 && (
              <section className="lr-card">
                <h3>这次认出来的元件</h3>
                <ul className="lr-list">
                  {found.map((c, i) => (
                    <li key={`${c.name}-${i}`}>
                      <span className="lr-name">{c.name}</span>
                      {c.type && <span className="lr-tag">{c.type}</span>}
                      <span className="lr-conf">{Math.round(c.confidence * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {msg && <p className="lr-msg">{msg}</p>}

        <div className="lr-foot">
          <button className="lr-btn lr-btn-ghost" onClick={onClose}>完成</button>
        </div>

        {showSettings && (
          <AiSettingsModal
            onClose={() => setShowSettings(false)}
            onSaved={(next) => { setConfig(next); setShowSettings(false); }}
          />
        )}

        <style jsx global>{`
          .lr-overlay { position: fixed; inset: 0; z-index: 420; background: rgba(4,7,14,0.78); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 18px; }
          .lr-modal { width: min(520px, 100%); max-height: 90vh; overflow-y: auto; background: #0d1626; border: 1px solid rgba(120,150,255,0.18); border-radius: 16px; padding: 18px; box-shadow: 0 30px 70px rgba(0,0,0,0.55); }
          .lr-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
          .lr-head h2 { margin: 0 0 4px; font-size: 16px; font-weight: 800; color: #fff; }
          .lr-head p { margin: 0; font-size: 12.5px; color: rgba(255,255,255,0.45); }
          .lr-close { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; }
          .lr-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
          .lr-card h3 { margin: 0 0 6px; font-size: 13.5px; font-weight: 700; color: #fff; }
          .lr-card p { margin: 0; font-size: 12.5px; line-height: 1.7; color: rgba(255,255,255,0.5); }
          .lr-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
          .lr-btn { border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); border-radius: 9px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
          .lr-btn:disabled { opacity: 0.45; cursor: default; }
          .lr-btn-primary { background: linear-gradient(135deg, #667eea 0%, #7c5cf0 100%); border-color: transparent; color: #fff; }
          .lr-btn-soft { background: rgba(102,126,234,0.16); border-color: rgba(102,126,234,0.35); color: #c7d2fe; }
          .lr-btn-ghost { background: transparent; }
          .lr-preview { display: block; margin-top: 12px; max-height: 220px; max-width: 100%; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); }
          .lr-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
          .lr-list li { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: rgba(255,255,255,0.8); }
          .lr-name { font-weight: 600; }
          .lr-tag { font-size: 11px; padding: 1px 7px; border-radius: 999px; background: rgba(102,126,234,0.16); color: #a5b4fc; }
          .lr-conf { margin-left: auto; font-size: 11.5px; color: rgba(255,255,255,0.45); }
          .lr-note { font-size: 12.5px; color: rgba(255,255,255,0.45); }
          .lr-msg { margin: 4px 0 0; font-size: 12.5px; color: #a5b4fc; }
          .lr-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
        `}</style>
      </div>
    </div>
  );
}
