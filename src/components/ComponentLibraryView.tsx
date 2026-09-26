'use client';

// 元件库：内置元件（随软件打包）+ 我自己的元件（本机存储）
// 学习用的一页：每张卡片一张图 + 一句话，点开看"怎么认、正负极、常见错误、怎么读参数"。

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStore } from '@/lib/store';
import { LIBRARY_CATEGORIES } from '@/lib/library/builtin';
import ComponentEditorModal from '@/components/ComponentEditorModal';
import type { LibraryComponent, LibrarySource } from '@/lib/store/types';

interface Props {
  onBack: () => void;
  /** 打开「关于 · 鸣谢」（署名统一收在那一页，这里不出现第三方名称） */
  onCredits: () => void;
}

const SOURCE_LABEL: Record<LibrarySource, { text: string; cls: string }> = {
  builtin: { text: '内置', cls: 'lib-badge lib-badge-plain' },
  user_created: { text: '我加的', cls: 'lib-badge lib-badge-green' },
  imported: { text: '收到的', cls: 'lib-badge lib-badge-blue' },
  ai_temp: { text: '识别来的', cls: 'lib-badge lib-badge-amber' },
};

export default function ComponentLibraryView({ onBack, onCredits }: Props) {
  const [items, setItems] = useState<LibraryComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('全部');
  const [keyword, setKeyword] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [editorFor, setEditorFor] = useState<LibraryComponent | null>(null);
  const [editorCopy, setEditorCopy] = useState<LibraryComponent | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await getStore().listLibrary());
    } catch (e) {
      setError(e instanceof Error ? e.message : '这台电脑的本地存储打不开');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => {
    const present = new Set(items.map((c) => c.category));
    return ['全部', ...LIBRARY_CATEGORIES.filter((c) => present.has(c)), ...[...present].filter((c) => !LIBRARY_CATEGORIES.includes(c as never))];
  }, [items]);

  const shown = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return items.filter((c) => {
      if (category !== '全部' && c.category !== category) return false;
      if (!kw) return true;
      const hay = [c.name, c.purpose, ...(c.aliases || []), ...(c.commonModels || [])].join(' ').toLowerCase();
      return hay.includes(kw);
    });
  }, [items, category, keyword]);

  const builtinCount = items.filter((c) => c.source === 'builtin').length;
  const mineCount = items.length - builtinCount;
  const current = items.find((c) => c.id === openId) || null;

  if (loading) {
    return <p className="lib-loading">正在打开元件库…</p>;
  }

  return (
    <div className="lib-wrap">
      <nav className="lib-crumb">
        <button type="button" className="lib-crumb-link" onClick={onBack}>我的工具箱</button>
        <span className="lib-crumb-sep">›</span>
        <span className="lib-crumb-cur">元件库</span>
      </nav>

      <header className="lib-hero">
        <div>
          <h1 className="lib-title">元件库</h1>
          <p className="lib-sub">
            共 {items.length} 个元件（内置 {builtinCount}
            {mineCount > 0 ? ` · 我的 ${mineCount}` : ''}）· 每个都有图、怎么认、常见错误
          </p>
        </div>
        <div className="lib-tools">
          <input
            className="lib-search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="找元件：电阻 / 1N4001 / 三极管…"
          />
          <button
            className="lib-add"
            onClick={() => { setEditorFor(null); setEditorCopy(null); setEditorOpen(true); }}
          >
            ＋ 自己加一个
          </button>
        </div>
      </header>

      {error && <div className="lib-error">{error}</div>}

      {/* 给学生的说明：内置的只是起步用，更希望大家自己加、互相传 */}
      <section className="lib-intro">
        <h2>内置的这 {builtinCount} 个，只是给你起步用的</h2>
        <p>
          我们挑的都是最常见、课堂上用得上的入门元件，够你把基础实验先做起来。
          但一个真正好用的元件库，应该长成<strong>你自己的样子</strong>——
          你手上有什么、课上用到什么、买到了什么新鲜玩意，都值得记下来。
        </p>
        <ul>
          <li>
            <strong>鼓励自己加</strong>：点右上角「＋ 自己加一个」，拍张图、写上「它是干嘛的 / 怎么认 / 有什么坑」，
            它就和内置的一样好用，新建项目时能直接挑。
          </li>
          <li>
            <strong>加完能传给别人</strong>：你自建的元件会跟着作品一起发出去。同学收下你的作品，
            就能把元件收进他自己的库——你的库越厚，别人拿到的起点越高。
          </li>
          <li>
            <strong>有能力的同学可以自己接识别服务</strong>：在「识别设置」里填上自己的凭据，
            以后拍张照就能自动生成元件卡，攒库快得多（不接也完全不影响使用）。
          </li>
        </ul>
        <p className="lib-intro-foot">
          一句话：内置的负责让你能开始，剩下的交给你和你的同学。
        </p>

        <div className="lib-share">
          <h3>想把整个元件库给别人？两种方法，都在这台电脑上就能做</h3>
          <ol>
            <li>
              <strong>把元件装进一件作品里发出去</strong>（推荐，最省事）<br />
              新建一件作品 → 在「元器件清单」里点「＋ 添加元件 → 从元件库选」，
              把想分享的元件一个个挑进去 → 打开作品点「分享作品」，把分享页或作品文件发给对方。<br />
              对方打开时会看到「这个作品里带着 N 个新元件」，点一下「全部加入我的元件库」，
              你的元件就进了他的库，连图片和说明一起。
            </li>
            <li>
              <strong>用「备份与恢复」整库打包</strong>（要传很多元件时用）<br />
              回工具箱首页 → 「备份与恢复」→「生成备份」，会得到一个压缩包，
              里面是全部作品 <em>加上你自己加的元件</em>。<br />
              对方拿到这个压缩包，同样进「备份与恢复」→「选择备份文件」，
              元件就会合并进他的库（他那儿已经有的，保留他自己那份，不会被覆盖）。
            </li>
          </ol>
          <p className="lib-share-note">
            注意：软件本身不带你这些元件——安装包和便携版里只有那 {builtinCount} 个内置元件。
            要传自己攒的库，就得走上面这两条路。
          </p>
        </div>
      </section>

      <div className="lib-chips">
        {categories.map((c) => (
          <button
            key={c}
            className={`lib-chip${category === c ? ' lib-chip-active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="lib-empty">
          <p>没找到这样的元件</p>
          <span>换个词试试，或者点上面的分类看看有什么。</span>
        </div>
      ) : (
        <div className="lib-grid">
          {shown.map((c) => {
            const badge = SOURCE_LABEL[c.source] || SOURCE_LABEL.builtin;
            return (
              <button key={c.id} className="lib-card" onClick={() => setOpenId(c.id)}>
                <span className="lib-thumb">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 内置元件是静态图，用户元件是本地 blob
                    <img src={c.imageUrl} alt={c.name} />
                  ) : (
                    <span className="lib-thumb-initial">{c.name.slice(0, 1)}</span>
                  )}
                </span>
                <span className="lib-card-name">{c.name}</span>
                <span className="lib-card-purpose">{c.purpose}</span>
                <span className="lib-card-foot">
                  <span className={badge.cls}>{badge.text}</span>
                  {c.pinCount ? <span className="lib-pins">{c.pinCount} 脚</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="lib-credit">
        <button type="button" className="lib-credit-link" onClick={onCredits}>关于 · 鸣谢</button>
      </p>

      {toast && <div className="lib-toast">{toast}</div>}

      {editorOpen && (
        <ComponentEditorModal
          editing={editorFor}
          copyFrom={editorCopy}
          onSaved={(id, isNew) => {
            setEditorOpen(false);
            setToast(isNew ? '已经加进你的元件库' : '资料已更新');
            void load();
            setOpenId(id);
          }}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {current && (
        <div className="lib-detail-overlay" onClick={() => setOpenId(null)}>
          <div className="lib-detail" onClick={(e) => e.stopPropagation()}>
            <header className="lib-detail-head">
              <div>
                <h2>{current.name}</h2>
                {current.aliases && current.aliases.length > 0 && (
                  <p className="lib-detail-alias">也叫：{current.aliases.join('、')}</p>
                )}
              </div>
              <button className="lib-close" onClick={() => setOpenId(null)} aria-label="关闭">✕</button>
            </header>

            <div className="lib-detail-body">
              <div className="lib-detail-figure">
                {current.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 同上
                  <img src={current.imageUrl} alt={current.name} />
                ) : (
                  <span className="lib-thumb-initial">{current.name.slice(0, 1)}</span>
                )}
              </div>

              <div className="lib-detail-rows">
                <Row label="它是干嘛的" value={current.purpose} strong />
                <Row label="怎么认出来" value={current.appearance} />
                <Row label="正负极 / 方向" value={current.polarity} />
                <Row label="怎么读参数" value={current.howToRead} />
                {current.commonModels && current.commonModels.length > 0 && (
                  <Row label="常见型号" value={current.commonModels.join('、')} />
                )}
                <Row
                  label="参数"
                  value={[
                    current.package && `封装 ${current.package}`,
                    current.pinCount ? `${current.pinCount} 个引脚` : '',
                    current.family && `类型 ${current.family}`,
                  ].filter(Boolean).join(' · ')}
                />
                {current.usedInProjects && current.usedInProjects.length > 0 && (
                  <Row label="能做的小项目" value={current.usedInProjects.join('、')} />
                )}
              </div>
            </div>

            {current.commonMistakes && current.commonMistakes.length > 0 && (
              <section className="lib-mistakes">
                <h3>新手常踩的坑</h3>
                <ul>
                  {current.commonMistakes.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </section>
            )}

            <footer className="lib-detail-foot">
              <span className={(SOURCE_LABEL[current.source] || SOURCE_LABEL.builtin).cls}>
                {(SOURCE_LABEL[current.source] || SOURCE_LABEL.builtin).text}
              </span>
              <div className="lib-detail-actions">
                {current.source === 'builtin' ? (
                  <button
                    className="lib-act"
                    onClick={() => { setEditorCopy(current); setEditorFor(null); setEditorOpen(true); setOpenId(null); }}
                  >
                    照着改一个
                  </button>
                ) : (
                  <>
                    <button
                      className="lib-act"
                      onClick={() => { setEditorFor(current); setEditorCopy(null); setEditorOpen(true); setOpenId(null); }}
                    >
                      补充 / 修改资料
                    </button>
                    <button
                      className="lib-act lib-act-danger"
                      onClick={async () => {
                        if (!confirm(`把「${current.name}」从你的元件库里删掉？`)) return;
                        await getStore().removeLibraryComponent(current.id);
                        setOpenId(null);
                        setToast(`已删掉「${current.name}」`);
                        void load();
                      }}
                    >
                      删除
                    </button>
                  </>
                )}
              </div>
            </footer>
          </div>
        </div>
      )}

      <style jsx global>{`
        .lib-wrap { max-width: 1200px; margin: 0 auto; padding: 96px 16px 64px; position: relative; z-index: 1; }
        .lib-crumb { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 14px; }
        .lib-crumb-link { background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: rgba(255,255,255,0.55); }
        .lib-crumb-link:hover { color: #9db8ff; }
        .lib-crumb-sep { color: rgba(255,255,255,0.25); }
        .lib-crumb-cur { color: #9db8ff; font-weight: 600; }
        .lib-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .lib-title { margin: 0 0 6px; font-size: clamp(22px, 3.4vw, 30px); font-weight: 800; color: #fff; letter-spacing: -0.4px; }
        .lib-sub { margin: 0; font-size: 13px; color: rgba(255,255,255,0.45); }
        .lib-search { width: min(320px, 70vw); padding: 10px 13px; border-radius: 10px; font-size: 13.5px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: #fff; outline: none; }
        .lib-search:focus { border-color: rgba(102,126,234,0.55); }
        .lib-tools { display: flex; gap: 10px; align-items: center; }
        .lib-add { padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; background: linear-gradient(135deg, #667eea 0%, #7c5cf0 100%); color: #fff; white-space: nowrap; }
        .lib-detail-actions { margin-left: auto; display: flex; gap: 8px; }
        .lib-act { padding: 7px 13px; border-radius: 9px; font-size: 12.5px; font-weight: 600; cursor: pointer; background: rgba(79,124,255,0.14); border: 1px solid rgba(79,124,255,0.32); color: #bcd0ff; }
        .lib-act-danger { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #fca5a5; }
        .lib-toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 470; padding: 10px 16px; border-radius: 10px; background: rgba(13,22,38,0.95); border: 1px solid rgba(120,150,255,0.25); color: #dbe4ff; font-size: 13px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        .lib-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .lib-chip { padding: 6px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 600; cursor: pointer; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.65); }
        .lib-chip:hover { color: #fff; border-color: rgba(120,150,255,0.4); }
        .lib-chip-active { background: rgba(79,124,255,0.18); border-color: rgba(79,124,255,0.45); color: #bcd0ff; }
        .lib-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(min(190px, 100%), 1fr)); }
        .lib-card { display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 12px; border-radius: 14px; cursor: pointer; background: linear-gradient(165deg, rgba(17,25,45,0.9), rgba(10,15,28,0.92)); border: 1px solid rgba(120,150,255,0.1); transition: border-color 0.2s, transform 0.2s; font-family: inherit; }
        .lib-card:hover { border-color: rgba(120,150,255,0.4); transform: translateY(-2px); }
        .lib-thumb { display: grid; place-items: center; aspect-ratio: 1 / 1; border-radius: 10px; background: #fff; overflow: hidden; margin-bottom: 4px; }
        .lib-thumb img { width: 100%; height: 100%; object-fit: contain; }
        .lib-thumb-initial { font-size: 40px; font-weight: 800; color: rgba(20,30,60,0.25); }
        .lib-card-name { font-size: 14.5px; font-weight: 700; color: #fff; }
        .lib-card-purpose { font-size: 12px; line-height: 1.6; color: rgba(255,255,255,0.5); }
        .lib-card-foot { display: flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 6px; }
        .lib-badge { font-size: 11px; padding: 1px 8px; border-radius: 999px; border: 1px solid transparent; }
        .lib-badge-plain { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.55); }
        .lib-badge-green { background: rgba(34,197,94,0.14); color: #6ee7b7; border-color: rgba(34,197,94,0.3); }
        .lib-badge-blue { background: rgba(79,124,255,0.16); color: #bcd0ff; border-color: rgba(79,124,255,0.35); }
        .lib-badge-amber { background: rgba(251,191,36,0.14); color: #fcd34d; border-color: rgba(251,191,36,0.3); }
        .lib-pins { font-size: 11px; color: rgba(255,255,255,0.35); }
        .lib-empty { border: 2px dashed rgba(102,126,234,0.25); border-radius: 16px; padding: 44px 20px; text-align: center; }
        .lib-empty p { margin: 0 0 6px; font-size: 15px; font-weight: 700; color: rgba(255,255,255,0.8); }
        .lib-empty span { font-size: 12.5px; color: rgba(255,255,255,0.4); }
        .lib-loading { color: rgba(255,255,255,0.4); text-align: center; padding: 120px 20px; }
        .lib-error { padding: 12px 15px; border-radius: 12px; margin-bottom: 16px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #fca5a5; font-size: 13px; }
        .lib-intro { padding: 16px 18px; border-radius: 14px; margin-bottom: 18px; background: rgba(102,126,234,0.06); border: 1px solid rgba(102,126,234,0.22); }
        .lib-intro h2 { margin: 0 0 8px; font-size: 15px; font-weight: 800; color: #dbe4ff; }
        .lib-intro p { margin: 0 0 10px; font-size: 13px; line-height: 1.85; color: rgba(255,255,255,0.62); }
        .lib-intro strong { color: #fff; font-weight: 700; }
        .lib-intro ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 7px; }
        .lib-intro li { font-size: 12.5px; line-height: 1.85; color: rgba(255,255,255,0.6); }
        .lib-share { margin-top: 16px; padding-top: 14px; border-top: 1px dashed rgba(255,255,255,0.12); }
        .lib-share h3 { margin: 0 0 10px; font-size: 13.5px; font-weight: 800; color: #dbe4ff; }
        .lib-share ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px; }
        .lib-share li { font-size: 12.5px; line-height: 1.9; color: rgba(255,255,255,0.62); }
        .lib-share strong { color: #fff; }
        .lib-share em { color: #a5b4fc; font-style: normal; text-decoration: underline; text-underline-offset: 2px; }
        .lib-share-note { margin: 12px 0 0 !important; font-size: 12px; color: rgba(255,255,255,0.45) !important; }        .lib-intro-foot { margin: 12px 0 0 !important; font-size: 12.5px; color: #a5b4fc !important; }
        .lib-credit { margin: 22px 0 0; font-size: 11.5px; }
        .lib-credit-link { background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: rgba(255,255,255,0.35); text-decoration: underline; text-underline-offset: 3px; }
        .lib-credit-link:hover { color: #9db8ff; }
        .lib-detail-overlay { position: fixed; inset: 0; z-index: 420; background: rgba(4,7,14,0.78); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 18px; }
        .lib-detail { width: min(720px, 100%); max-height: 88vh; overflow-y: auto; background: #0d1626; border: 1px solid rgba(120,150,255,0.18); border-radius: 16px; padding: 18px; box-shadow: 0 30px 70px rgba(0,0,0,0.55); }
        .lib-detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
        .lib-detail-head h2 { margin: 0 0 4px; font-size: 18px; font-weight: 800; color: #fff; }
        .lib-detail-alias { margin: 0; font-size: 12px; color: rgba(255,255,255,0.4); }
        .lib-close { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; }
        .lib-detail-body { display: grid; gap: 16px; grid-template-columns: 1fr; }
        @media (min-width: 620px) { .lib-detail-body { grid-template-columns: 200px minmax(0, 1fr); } }
        .lib-detail-figure { display: grid; place-items: center; background: #fff; border-radius: 12px; aspect-ratio: 1 / 1; overflow: hidden; }
        .lib-detail-figure img { width: 100%; height: 100%; object-fit: contain; }
        .lib-detail-rows { display: flex; flex-direction: column; gap: 10px; }
        .lib-row { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 10px; font-size: 13px; }
        .lib-row-label { color: rgba(255,255,255,0.4); }
        .lib-row-value { color: rgba(255,255,255,0.82); line-height: 1.7; }
        .lib-row-strong .lib-row-value { color: #fff; font-weight: 600; }
        .lib-mistakes { margin-top: 16px; padding: 14px; border-radius: 12px; background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.18); }
        .lib-mistakes h3 { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #fcd34d; }
        .lib-mistakes ul { margin: 0; padding-left: 18px; }
        .lib-mistakes li { font-size: 12.5px; line-height: 1.9; color: rgba(255,255,255,0.75); }
        .lib-detail-foot { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.07); }
      `}</style>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value?: string; strong?: boolean }) {
  if (!value) return null;
  return (
    <div className={`lib-row${strong ? ' lib-row-strong' : ''}`}>
      <span className="lib-row-label">{label}</span>
      <span className="lib-row-value">{value}</span>
    </div>
  );
}
