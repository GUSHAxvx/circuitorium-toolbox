'use client';

// 从元件库里挑一个元件：填进项目的元件清单（BOM），并记住它来自库里哪个元件。
// 这样导出作品时，这个元件会自动跟着作品走（别人打开就能收进自己的元件库）。

import { useEffect, useMemo, useState } from 'react';
import { getStore } from '@/lib/store';
import { LIBRARY_CATEGORIES } from '@/lib/library/builtin';
import type { LibraryComponent } from '@/lib/store/types';

interface Props {
  onPick: (item: LibraryComponent) => void;
  onClose: () => void;
  /** 打开时直接新建一个自定义元件 */
  onCreateNew?: () => void;
}

export default function LibraryPicker({ onPick, onClose, onCreateNew }: Props) {
  const [items, setItems] = useState<LibraryComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('全部');

  useEffect(() => {
    getStore().listLibrary()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const categories = useMemo(() => {
    const present = new Set(items.map((c) => c.category));
    return ['全部', ...LIBRARY_CATEGORIES.filter((c) => present.has(c))];
  }, [items]);

  const shown = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return items.filter((c) => {
      if (category !== '全部' && c.category !== category) return false;
      if (!kw) return true;
      return [c.name, c.purpose, ...(c.aliases || []), ...(c.commonModels || [])]
        .join(' ').toLowerCase().includes(kw);
    });
  }, [items, keyword, category]);

  return (
    <div className="lp-overlay" onClick={onClose}>
      <div className="lp-modal" onClick={(e) => e.stopPropagation()}>
        <header className="lp-head">
          <div>
            <h2>从元件库挑一个</h2>
            <p>挑中的元件会加进这件作品，并跟着作品一起传给别人</p>
          </div>
          <button className="lp-close" onClick={onClose} aria-label="关闭">✕</button>
        </header>

        <div className="lp-tools">
          <input
            className="lp-search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="找元件：电阻 / 1N4001 / 三极管…"
            autoFocus
          />
          {onCreateNew && (
            <button className="lp-btn lp-btn-soft" onClick={onCreateNew}>＋ 自己加一个</button>
          )}
        </div>

        <div className="lp-chips">
          {categories.map((c) => (
            <button key={c} className={`lp-chip${category === c ? ' lp-chip-active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="lp-dim">正在打开元件库…</p>
        ) : shown.length === 0 ? (
          <p className="lp-dim">没找到这样的元件</p>
        ) : (
          <ul className="lp-list">
            {shown.map((c) => (
              <li key={c.id}>
                <button className="lp-item" onClick={() => onPick(c)}>
                  <span className="lp-thumb">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- 内置是静态图，自定义是本地 blob
                      <img src={c.imageUrl} alt="" />
                    ) : (
                      <span className="lp-initial">{c.name.slice(0, 1)}</span>
                    )}
                  </span>
                  <span className="lp-body">
                    <span className="lp-name">
                      {c.name}
                      {c.source !== 'builtin' && <span className="lp-tag">我的</span>}
                    </span>
                    <span className="lp-purpose">{c.purpose || c.appearance}</span>
                  </span>
                  {c.pinCount ? <span className="lp-pins">{c.pinCount} 脚</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        <style jsx global>{`
          .lp-overlay { position: fixed; inset: 0; z-index: 450; background: rgba(4,7,14,0.78); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 18px; }
          .lp-modal { width: min(620px, 100%); max-height: 88vh; display: flex; flex-direction: column; background: #0d1626; border: 1px solid rgba(120,150,255,0.18); border-radius: 16px; padding: 18px; box-shadow: 0 30px 70px rgba(0,0,0,0.55); }
          .lp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
          .lp-head h2 { margin: 0 0 4px; font-size: 16px; font-weight: 800; color: #fff; }
          .lp-head p { margin: 0; font-size: 12.5px; color: rgba(255,255,255,0.45); }
          .lp-close { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; }
          .lp-tools { display: flex; gap: 10px; margin-bottom: 10px; }
          .lp-search { flex: 1; padding: 10px 13px; border-radius: 10px; font-size: 13.5px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: #fff; outline: none; }
          .lp-search:focus { border-color: rgba(102,126,234,0.55); }
          .lp-btn { padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); white-space: nowrap; }
          .lp-btn-soft { background: rgba(79,124,255,0.14); border-color: rgba(79,124,255,0.32); color: #bcd0ff; }
          .lp-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
          .lp-chip { padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.62); }
          .lp-chip-active { background: rgba(79,124,255,0.18); border-color: rgba(79,124,255,0.45); color: #bcd0ff; }
          .lp-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); }
          .lp-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px; border-radius: 12px; cursor: pointer; text-align: left; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); font-family: inherit; }
          .lp-item:hover { border-color: rgba(120,150,255,0.4); background: rgba(102,126,234,0.07); }
          .lp-thumb { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 9px; background: #fff; overflow: hidden; flex-shrink: 0; }
          .lp-thumb img { width: 100%; height: 100%; object-fit: contain; }
          .lp-initial { font-weight: 800; color: rgba(20,30,60,0.3); }
          .lp-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
          .lp-name { font-size: 13px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px; }
          .lp-tag { font-size: 10.5px; padding: 0 6px; border-radius: 999px; background: rgba(34,197,94,0.14); color: #6ee7b7; }
          .lp-purpose { font-size: 11.5px; color: rgba(255,255,255,0.45); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .lp-pins { margin-left: auto; font-size: 11px; color: rgba(255,255,255,0.35); flex-shrink: 0; }
          .lp-dim { color: rgba(255,255,255,0.4); font-size: 13px; text-align: center; padding: 24px 0; }
        `}</style>
      </div>
    </div>
  );
}
