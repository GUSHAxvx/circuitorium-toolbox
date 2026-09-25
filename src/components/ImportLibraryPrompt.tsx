'use client';

// 打开别人的作品时，如果作品里带着"自定义元件"，问一句要不要收进自己的元件库。
// 任务书要求：用户确认后再写入（不确认就只留着作品）。

import { useState } from 'react';
import { getStore } from '@/lib/store';
import type { LibraryComponentInput } from '@/lib/store/types';

interface Props {
  items: LibraryComponentInput[];
  alreadyHave: { id: string; name: string }[];
  fromProject: string;
  /** 用户选择后回调：added=加入的数量；跳过的传 0 */
  onDone: (added: number) => void;
  onClose: () => void;
}

export default function ImportLibraryPrompt({ items, alreadyHave, fromProject, onDone, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(items.map((i) => i.id || i.name)));

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const picked = items.filter((i) => checked.has(i.id || i.name));
      const res = await getStore().importLibraryComponents(picked, fromProject);
      onDone(res.added.length);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="il-overlay" onClick={onClose}>
      <div className="il-modal" onClick={(e) => e.stopPropagation()}>
        <header className="il-head">
          <div>
            <h2>这个作品里带着 {items.length} 个新元件</h2>
            <p>收进你的元件库，以后新建项目就能直接用；不要也行，作品照样能看能改。</p>
          </div>
          <button className="il-close" onClick={onClose} aria-label="关闭">✕</button>
        </header>

        <ul className="il-list">
          {items.map((item) => {
            const key = item.id || item.name;
            return (
              <li key={key}>
                <label className="il-item">
                  <input type="checkbox" checked={checked.has(key)} onChange={() => toggle(key)} />
                  <span className="il-thumb">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- 从作品里带出来的图，是本机 blob
                      <img src={URL.createObjectURL(item.image)} alt="" />
                    ) : (
                      <span className="il-initial">{item.name.slice(0, 1)}</span>
                    )}
                  </span>
                  <span className="il-body">
                    <span className="il-name">{item.name}</span>
                    <span className="il-purpose">{item.purpose || item.appearance || '（没有说明）'}</span>
                  </span>
                  {item.category && <span className="il-tag">{item.category}</span>}
                </label>
              </li>
            );
          })}
        </ul>

        {alreadyHave.length > 0 && (
          <p className="il-note">
            另有 {alreadyHave.length} 个元件你这里已经有了（{alreadyHave.map((a) => a.name).join('、')}），保留你本地的版本。
          </p>
        )}

        <footer className="il-foot">
          <button className="il-btn il-btn-primary" onClick={confirm} disabled={busy || checked.size === 0}>
            {busy ? '正在加入…' : `全部加入我的元件库（${checked.size}）`}
          </button>
          <button className="il-btn il-btn-ghost" onClick={() => onDone(0)} disabled={busy}>
            只看项目，不加入
          </button>
        </footer>

        <style jsx global>{`
          .il-overlay { position: fixed; inset: 0; z-index: 440; background: rgba(4,7,14,0.78); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 18px; }
          .il-modal { width: min(560px, 100%); max-height: 88vh; overflow-y: auto; background: #0d1626; border: 1px solid rgba(120,150,255,0.18); border-radius: 16px; padding: 18px; box-shadow: 0 30px 70px rgba(0,0,0,0.55); }
          .il-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
          .il-head h2 { margin: 0 0 4px; font-size: 16px; font-weight: 800; color: #fff; }
          .il-head p { margin: 0; font-size: 12.5px; line-height: 1.7; color: rgba(255,255,255,0.45); }
          .il-close { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; }
          .il-list { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
          .il-item { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; }
          .il-item:hover { border-color: rgba(120,150,255,0.35); }
          .il-item input { width: 16px; height: 16px; accent-color: #667eea; }
          .il-thumb { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 9px; background: #fff; overflow: hidden; flex-shrink: 0; }
          .il-thumb img { width: 100%; height: 100%; object-fit: contain; }
          .il-initial { font-weight: 800; color: rgba(20,30,60,0.3); }
          .il-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
          .il-name { font-size: 13.5px; font-weight: 700; color: #fff; }
          .il-purpose { font-size: 12px; color: rgba(255,255,255,0.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .il-tag { margin-left: auto; font-size: 11px; padding: 1px 8px; border-radius: 999px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.55); flex-shrink: 0; }
          .il-note { margin: 0 0 12px; font-size: 12px; line-height: 1.7; color: rgba(255,255,255,0.4); }
          .il-foot { display: flex; gap: 10px; flex-wrap: wrap; }
          .il-btn { padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); }
          .il-btn-primary { background: linear-gradient(135deg, #667eea 0%, #7c5cf0 100%); border-color: transparent; color: #fff; }
          .il-btn:disabled { opacity: 0.55; cursor: default; }
        `}</style>
      </div>
    </div>
  );
}
