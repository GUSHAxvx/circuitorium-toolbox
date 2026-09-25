'use client';

// 卍解项目的「程序代码」区：贴代码 / 选文件、看、复制、改说明、删。
// 只有卍解难度的作品才会渲染这块；始解作品完全不受影响。

import { useEffect, useRef, useState } from 'react';
import { getStore } from '@/lib/store';
import { copyText } from '@/lib/client';
import type { ToolboxCodeFile } from '@/lib/store/types';

interface Props {
  projectId: string;
  /** 代码有变化时通知外面刷新统计 */
  onChange?: () => void;
}

/** 代码文件最多 20 个、单个 20 万字符（课堂作业绰绰有余） */
const LIMITS = { maxFiles: 20, maxChars: 200_000 };

function guessNameFromFile(fileName: string): string {
  return fileName.replace(/^.*[\\/]/, '').slice(0, 80);
}

export default function ProjectCodePanel({ projectId, onChange }: Props) {
  const [files, setFiles] = useState<ToolboxCodeFile[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', content: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const list = await getStore().listCodeFiles(projectId);
    setFiles(list);
    setOpenId((cur) => (cur && list.some((f) => f.id === cur) ? cur : list[0]?.id ?? null));
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > LIMITS.maxChars) {
      setMsg('这个文件太大了（超过 200KB），先精简一下再放进来');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const text = await file.text();
    setDraft({ name: guessNameFromFile(file.name), content: text, note: '' });
    setAdding(true);
    setMsg('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async () => {
    if (!draft.content.trim()) { setMsg('代码还是空的，先贴点内容进来'); return; }
    if (files.length >= LIMITS.maxFiles) { setMsg(`一个作品最多放 ${LIMITS.maxFiles} 段代码`); return; }
    setBusy(true);
    try {
      await getStore().addCodeFile(projectId, {
        name: draft.name.trim() || `代码${files.length + 1}.ino`,
        content: draft.content,
        note: draft.note.trim(),
      });
      setDraft({ name: '', content: '', note: '' });
      setAdding(false);
      await load();
      setMsg('代码已经放进这个作品了');
      onChange?.();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: ToolboxCodeFile) => {
    if (!confirm(`把「${item.name}」从这件作品里删掉？`)) return;
    await getStore().removeCodeFile(item.id);
    await load();
    setMsg('已删掉');
    onChange?.();
  };

  const current = files.find((f) => f.id === openId) || null;

  return (
    <div className="pc-wrap">
      <div className="pc-head">
        <h2>程序代码 <span className="pc-count">{files.length}</span></h2>
        <div className="pc-head-actions">
          <label className="pc-btn pc-btn-soft" style={{ cursor: 'pointer' }}>
            选一个代码文件
            <input ref={fileRef} type="file" accept=".ino,.pde,.py,.c,.h,.cpp,.hpp,.js,.ts,.txt,.md,.json,.mix" style={{ display: 'none' }} onChange={pickFile} />
          </label>
          <button className="pc-btn pc-btn-soft" onClick={() => { setAdding((v) => !v); setMsg(''); }}>
            {adding ? '收起' : '＋ 直接贴代码'}
          </button>
        </div>
      </div>

      {adding && (
        <div className="pc-editor">
          <div className="pc-editor-row">
            <input
              className="pc-input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="文件名，例如 blink.ino"
            />
            <input
              className="pc-input"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="这段代码干嘛用的（可以不写）"
            />
          </div>
          <textarea
            className="pc-textarea"
            rows={10}
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            placeholder="把代码贴在这里…"
            spellCheck={false}
          />
          <div className="pc-editor-foot">
            <button className="pc-btn pc-btn-primary" onClick={save} disabled={busy}>{busy ? '保存中…' : '放进作品'}</button>
            <button className="pc-btn pc-btn-ghost" onClick={() => { setAdding(false); setDraft({ name: '', content: '', note: '' }); }}>取消</button>
            <span className="pc-hint">单个文件上限 200KB，一个作品最多 {LIMITS.maxFiles} 段</span>
          </div>
        </div>
      )}

      {files.length === 0 && !adding ? (
        <p className="pc-empty">
          还没有代码。卍解难度的作品要写程序——把 <code>.ino</code> / <code>.py</code> 这类文件放进来，
          别人打开你的作品就能看到、能照着改。
        </p>
      ) : files.length > 0 ? (
        <div className="pc-body">
          <ul className="pc-list">
            {files.map((f) => (
              <li key={f.id}>
                <button className={`pc-item${f.id === openId ? ' pc-item-on' : ''}`} onClick={() => setOpenId(f.id)}>
                  <span className="pc-item-name">{f.name}</span>
                  <span className="pc-item-meta">
                    {f.language || '文本'} · {f.content.split('\n').length} 行
                    {f.note ? ` · ${f.note}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {current && (
            <div className="pc-view">
              <div className="pc-view-head">
                <span className="pc-view-name">{current.name}</span>
                <div className="pc-view-actions">
                  <button className="pc-mini" onClick={async () => { await copyText(current.content); setMsg('代码已复制'); }}>复制代码</button>
                  <button
                    className="pc-mini"
                    onClick={async () => {
                      const name = prompt('改个文件名：', current.name);
                      if (!name) return;
                      await getStore().updateCodeFile(current.id, { name: name.trim().slice(0, 80) });
                      await load();
                      setMsg('文件名已改');
                    }}
                  >
                    改名
                  </button>
                  <button className="pc-mini pc-mini-danger" onClick={() => void remove(current)}>删除</button>
                </div>
              </div>
              <pre className="pc-code"><code>{current.content}</code></pre>
            </div>
          )}
        </div>
      ) : null}

      {msg && <p className="pc-msg">{msg}</p>}

      <style jsx global>{`
        .pc-wrap { margin-top: 22px; }
        .pc-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .pc-head h2 { margin: 0; font-size: 15px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px; }
        .pc-count { font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: 999px; background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.6); }
        .pc-head-actions { display: flex; gap: 8px; }
        .pc-btn { display: inline-flex; align-items: center; padding: 8px 14px; border-radius: 9px; font-size: 12.5px; font-weight: 600; cursor: pointer; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); font-family: inherit; }
        .pc-btn-primary { background: linear-gradient(135deg, #667eea 0%, #7c5cf0 100%); border-color: transparent; color: #fff; }
        .pc-btn-soft { background: rgba(79,124,255,0.14); border-color: rgba(79,124,255,0.32); color: #bcd0ff; }
        .pc-btn:disabled { opacity: 0.55; cursor: default; }
        .pc-editor { padding: 14px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.09); margin-bottom: 14px; }
        .pc-editor-row { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
        .pc-input { flex: 1; min-width: 180px; padding: 9px 12px; border-radius: 9px; font-size: 13px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: #fff; outline: none; font-family: inherit; }
        .pc-textarea { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 10px; font-size: 12.5px; line-height: 1.7; font-family: ui-monospace, Consolas, monospace; background: rgba(6,10,20,0.75); border: 1px solid rgba(255,255,255,0.12); color: #e6edf3; outline: none; resize: vertical; }
        .pc-editor-foot { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
        .pc-hint { font-size: 11.5px; color: rgba(255,255,255,0.35); }
        .pc-empty { margin: 0; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); font-size: 12.5px; line-height: 1.9; color: rgba(255,255,255,0.45); }
        .pc-empty code { font-family: ui-monospace, monospace; font-size: 11.5px; color: #a5b4fc; }
        .pc-body { display: grid; gap: 12px; grid-template-columns: 1fr; }
        @media (min-width: 760px) { .pc-body { grid-template-columns: 220px minmax(0, 1fr); } }
        .pc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .pc-item { display: flex; flex-direction: column; gap: 3px; width: 100%; text-align: left; padding: 9px 11px; border-radius: 10px; cursor: pointer; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); font-family: inherit; }
        .pc-item-on { background: rgba(102,126,234,0.12); border-color: rgba(102,126,234,0.4); }
        .pc-item-name { font-size: 12.5px; font-weight: 700; color: #fff; word-break: break-all; }
        .pc-item-meta { font-size: 11px; color: rgba(255,255,255,0.42); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pc-view { min-width: 0; border-radius: 12px; border: 1px solid rgba(255,255,255,0.09); overflow: hidden; }
        .pc-view-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 9px 12px; background: rgba(255,255,255,0.04); flex-wrap: wrap; }
        .pc-view-name { font-size: 12.5px; font-weight: 700; color: #dbe4ff; }
        .pc-view-actions { display: flex; gap: 6px; }
        .pc-mini { padding: 5px 10px; border-radius: 7px; font-size: 11.5px; font-weight: 600; cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.8); font-family: inherit; }
        .pc-mini-danger { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #fca5a5; }
        .pc-code { margin: 0; padding: 14px; max-height: 420px; overflow: auto; background: rgba(6,10,20,0.8); font-family: ui-monospace, Consolas, monospace; font-size: 12px; line-height: 1.75; color: #d7e3f4; white-space: pre; }
        .pc-msg { margin: 10px 0 0; font-size: 12.5px; color: #6ee7b7; }
      `}</style>
    </div>
  );
}
