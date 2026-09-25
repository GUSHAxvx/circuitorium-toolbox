'use client';

// 卍解项目的「程序代码」面板：四个标签页
//   程序代码 —— 选文件 / 贴代码，按分组看，含 Keil（MDK-ARM / C51）那一套文件
//   接线表   —— 哪个模块的哪只脚接到开发板哪只脚
//   调试记录 —— 踩过的坑与解决办法
//   开发环境 —— 用什么软件、装哪些库
// 只有卍解难度的作品会渲染这块；始解作品完全不受影响。

import { useEffect, useRef, useState } from 'react';
import { getStore } from '@/lib/store';
import { CODE_GROUPS, type ToolboxCodeFile, type ToolboxDebugNote, type ToolboxPinRow } from '@/lib/store/types';
import { copyText } from '@/lib/client';

interface Props {
  projectId: string;
  /** 开发环境说明存在作品本身上 */
  codeNote: string;
  onChange?: () => void;
}

const LIMITS = { maxFiles: 40, maxChars: 200_000 };

/** 认得出来的代码/工程文件后缀（Keil 的 .uvproj* 也在内） */
const ACCEPT = [
  '.ino', '.pde', '.py', '.c', '.h', '.cpp', '.hpp', '.cc', '.js', '.ts', '.mix',
  '.uvproj', '.uvprojx', '.uvopt', '.uvoptx', '.sct', '.s', '.asm', '.a51', '.inc',
  '.hex', '.map', '.lst', '.txt', '.md', '.json',
].join(',');

/** 按字节读文件：先按 UTF-8，失败就按 GBK（Keil 默认就是 GBK，中文注释不会变乱码） */
async function readCodeFile(file: File): Promise<{ text: string; encoding: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    try {
      return { text: new TextDecoder('gbk').decode(bytes), encoding: 'gbk' };
    } catch {
      return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8' };
    }
  }
}

const baseName = (p: string) => p.replace(/^.*[\\/]/, '').slice(0, 80);

export default function ProjectCodePanel({ projectId, codeNote, onChange }: Props) {
  const [tab, setTab] = useState<'code' | 'pins' | 'debug' | 'env'>('code');
  const [files, setFiles] = useState<ToolboxCodeFile[]>([]);
  const [pins, setPins] = useState<ToolboxPinRow[]>([]);
  const [debugs, setDebugs] = useState<ToolboxDebugNote[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', content: '', note: '', group: '', encoding: 'utf-8' });
  const [pinDraft, setPinDraft] = useState({ module: '', pin: '', boardPin: '', note: '' });
  const [debugDraft, setDebugDraft] = useState({ problem: '', solution: '' });
  const [env, setEnv] = useState(codeNote);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const store = getStore();
    const [c, p, d] = await Promise.all([
      store.listCodeFiles(projectId),
      store.listPinRows(projectId),
      store.listDebugNotes(projectId),
    ]);
    setFiles(c);
    setPins(p);
    setDebugs(d);
    setOpenId((cur) => (cur && c.some((f) => f.id === cur) ? cur : c[0]?.id ?? null));
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => { setEnv(codeNote); }, [codeNote]);

  // ===== 代码 =====
  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > LIMITS.maxChars) {
      setMsg('这个文件太大了（超过 200KB），先精简一下再放进来');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const { text, encoding } = await readCodeFile(file);
    setDraft({ name: baseName(file.name), content: text, note: '', group: '', encoding });
    setAdding(true);
    setTab('code');
    setMsg(encoding === 'gbk' ? '这个文件是 GBK 编码（Keil 常见），已经转成正常中文' : '');
    if (fileRef.current) fileRef.current.value = '';
  };

  const saveCode = async () => {
    if (!draft.content.trim()) { setMsg('代码还是空的，先贴点内容进来'); return; }
    if (files.length >= LIMITS.maxFiles) { setMsg(`一个作品最多放 ${LIMITS.maxFiles} 段代码`); return; }
    setBusy(true);
    try {
      await getStore().addCodeFile(projectId, {
        name: draft.name.trim() || `代码${files.length + 1}.txt`,
        content: draft.content,
        note: draft.note.trim(),
        group: draft.group || undefined,
        encoding: draft.encoding,
      });
      setDraft({ name: '', content: '', note: '', group: '', encoding: 'utf-8' });
      setAdding(false);
      await load();
      setMsg('代码已经放进这个作品了');
      onChange?.();
    } finally {
      setBusy(false);
    }
  };

  const removeCode = async (item: ToolboxCodeFile) => {
    if (!confirm(`把「${item.name}」从这件作品里删掉？`)) return;
    await getStore().removeCodeFile(item.id);
    await load();
    setMsg('已删掉');
    onChange?.();
  };

  const current = files.find((f) => f.id === openId) || null;

  // ===== 接线表 =====
  const addPin = async () => {
    if (!pinDraft.module.trim() && !pinDraft.boardPin.trim()) { setMsg('至少填个模块名或引脚'); return; }
    setBusy(true);
    try {
      await getStore().addPinRow(projectId, pinDraft);
      setPinDraft({ module: '', pin: '', boardPin: '', note: '' });
      await load();
      setMsg('接线记下了');
      onChange?.();
    } finally {
      setBusy(false);
    }
  };

  // ===== 调试记录 =====
  const addDebug = async () => {
    if (!debugDraft.problem.trim()) { setMsg('先写一下遇到什么问题'); return; }
    setBusy(true);
    try {
      await getStore().addDebugNote(projectId, debugDraft);
      setDebugDraft({ problem: '', solution: '' });
      await load();
      setMsg('调试记录加上了');
      onChange?.();
    } finally {
      setBusy(false);
    }
  };

  // 代码按分组展示
  const grouped = CODE_GROUPS
    .map((g) => ({ group: g as string, items: files.filter((f) => (f.group || '其它') === g) }))
    .filter((g) => g.items.length > 0);
  const ungrouped = files.filter((f) => !CODE_GROUPS.includes((f.group || '其它') as never));
  if (ungrouped.length) grouped.push({ group: '其它', items: ungrouped });

  return (
    <div className="pc-wrap">
      <div className="pc-tabs">
        <button className={`pc-tab${tab === 'code' ? ' pc-tab-on' : ''}`} onClick={() => setTab('code')}>
          程序代码 <span className="pc-count">{files.length}</span>
        </button>
        <button className={`pc-tab${tab === 'pins' ? ' pc-tab-on' : ''}`} onClick={() => setTab('pins')}>
          接线表 <span className="pc-count">{pins.length}</span>
        </button>
        <button className={`pc-tab${tab === 'debug' ? ' pc-tab-on' : ''}`} onClick={() => setTab('debug')}>
          调试记录 <span className="pc-count">{debugs.length}</span>
        </button>
        <button className={`pc-tab${tab === 'env' ? ' pc-tab-on' : ''}`} onClick={() => setTab('env')}>
          开发环境
        </button>
      </div>

      {/* ================= 程序代码 ================= */}
      {tab === 'code' && (
        <>
          <div className="pc-head">
            <p className="pc-sub">Arduino、Keil（.uvproj / .c / .h / .s）、Python 都放得下；代码会跟着作品一起传给别人</p>
            <div className="pc-head-actions">
              <label className="pc-btn pc-btn-soft" style={{ cursor: 'pointer' }}>
                选一个文件
                <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={pickFile} />
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
                  placeholder="文件名，例如 main.c / project.uvprojx"
                />
                <input
                  className="pc-input"
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  placeholder="这段代码干嘛用的（可以不写）"
                />
                <select
                  className="pc-input pc-select"
                  value={draft.group}
                  onChange={(e) => setDraft({ ...draft, group: e.target.value })}
                >
                  <option value="">自动判断分组</option>
                  {CODE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
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
                <button className="pc-btn pc-btn-primary" onClick={saveCode} disabled={busy}>{busy ? '保存中…' : '放进作品'}</button>
                <button className="pc-btn pc-btn-ghost" onClick={() => { setAdding(false); setDraft({ name: '', content: '', note: '', group: '', encoding: 'utf-8' }); }}>取消</button>
                <span className="pc-hint">单个文件上限 200KB，一个作品最多 {LIMITS.maxFiles} 段；中文注释是 GBK 也能正常读</span>
              </div>
            </div>
          )}

          {files.length === 0 && !adding ? (
            <p className="pc-empty">
              还没有代码。把 <code>main.c</code> / <code>project.uvprojx</code> / <code>blink.ino</code> 这类文件放进来，
              别人打开你的作品就能看到、能照着改。
            </p>
          ) : files.length > 0 ? (
            <div className="pc-body">
              <div className="pc-list">
                {grouped.map((g) => (
                  <div key={g.group} className="pc-group">
                    <p className="pc-group-title">{g.group}</p>
                    <ul>
                      {g.items.map((f) => (
                        <li key={f.id}>
                          <button className={`pc-item${f.id === openId ? ' pc-item-on' : ''}`} onClick={() => setOpenId(f.id)}>
                            <span className="pc-item-name">{f.name}</span>
                            <span className="pc-item-meta">
                              {f.language || '文本'} · {f.content.split('\n').length} 行
                              {f.encoding === 'gbk' ? ' · GBK' : ''}
                              {f.note ? ` · ${f.note}` : ''}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {current && (
                <div className="pc-view">
                  <div className="pc-view-head">
                    <span className="pc-view-name">
                      {current.name}
                      <span className="pc-view-tag">{current.language || '文本'}</span>
                    </span>
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
                      <button className="pc-mini pc-mini-danger" onClick={() => void removeCode(current)}>删除</button>
                    </div>
                  </div>
                  <pre className="pc-code"><code>{current.content}</code></pre>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}

      {/* ================= 接线表 ================= */}
      {tab === 'pins' && (
        <>
          <p className="pc-sub">哪只脚接哪只脚，写清楚就不用对着照片猜了——这张表也会跟着作品传给别人</p>
          <div className="pc-editor pc-inline-form">
            <input className="pc-input" value={pinDraft.module} onChange={(e) => setPinDraft({ ...pinDraft, module: e.target.value })} placeholder="模块 / 元件，例如 超声波 HC-SR04" />
            <input className="pc-input pc-input-sm" value={pinDraft.pin} onChange={(e) => setPinDraft({ ...pinDraft, pin: e.target.value })} placeholder="模块引脚，例如 TRIG" />
            <span className="pc-arrow">→</span>
            <input className="pc-input pc-input-sm" value={pinDraft.boardPin} onChange={(e) => setPinDraft({ ...pinDraft, boardPin: e.target.value })} placeholder="开发板，例如 D2" />
            <input className="pc-input" value={pinDraft.note} onChange={(e) => setPinDraft({ ...pinDraft, note: e.target.value })} placeholder="备注，例如 串 1k 电阻" />
            <button className="pc-btn pc-btn-primary" onClick={addPin} disabled={busy}>加一行</button>
          </div>

          {pins.length === 0 ? (
            <p className="pc-empty">还没有接线记录。建议把电源（VCC / GND）先写清楚，再写信号脚。</p>
          ) : (
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead>
                  <tr><th>模块 / 元件</th><th>模块引脚</th><th>接到</th><th>备注</th><th /></tr>
                </thead>
                <tbody>
                  {pins.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <input className="pc-cell" defaultValue={r.module} onBlur={(e) => void getStore().updatePinRow(r.id, { module: e.target.value }).then(load)} />
                      </td>
                      <td>
                        <input className="pc-cell" defaultValue={r.pin} onBlur={(e) => void getStore().updatePinRow(r.id, { pin: e.target.value }).then(load)} />
                      </td>
                      <td>
                        <input className="pc-cell pc-cell-strong" defaultValue={r.boardPin} onBlur={(e) => void getStore().updatePinRow(r.id, { boardPin: e.target.value }).then(load)} />
                      </td>
                      <td>
                        <input className="pc-cell" defaultValue={r.note} onBlur={(e) => void getStore().updatePinRow(r.id, { note: e.target.value }).then(load)} />
                      </td>
                      <td>
                        <button className="pc-mini pc-mini-danger" onClick={async () => { await getStore().removePinRow(r.id); await load(); }}>删</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ================= 调试记录 ================= */}
      {tab === 'debug' && (
        <>
          <p className="pc-sub">写代码最值钱的就是这些坑：当时什么现象、怎么解决的。别人照着能少走弯路</p>
          <div className="pc-editor">
            <input className="pc-input pc-input-full" value={debugDraft.problem} onChange={(e) => setDebugDraft({ ...debugDraft, problem: e.target.value })} placeholder="遇到什么问题，例如 串口一直是乱码" />
            <textarea className="pc-textarea pc-textarea-sm" rows={3} value={debugDraft.solution} onChange={(e) => setDebugDraft({ ...debugDraft, solution: e.target.value })} placeholder="怎么解决的，例如 波特率要跟代码里一致，都是 9600" />
            <div className="pc-editor-foot">
              <button className="pc-btn pc-btn-primary" onClick={addDebug} disabled={busy}>记下来</button>
            </div>
          </div>

          {debugs.length === 0 ? (
            <p className="pc-empty">还没有调试记录。哪怕只写一条「为什么灯不亮」，对下一个做的人都是帮大忙。</p>
          ) : (
            <ul className="pc-debugs">
              {debugs.map((d) => (
                <li key={d.id} className="pc-debug">
                  <div className="pc-debug-head">
                    <span className="pc-debug-problem">{d.problem}</span>
                    <button className="pc-mini pc-mini-danger" onClick={async () => { await getStore().removeDebugNote(d.id); await load(); }}>删</button>
                  </div>
                  <p className="pc-debug-solution">{d.solution || '（还没写解决办法）'}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* ================= 开发环境 ================= */}
      {tab === 'env' && (
        <>
          <p className="pc-sub">别人要照着做，得先装对软件和库。写在这里最省事</p>
          <textarea
            className="pc-textarea"
            rows={5}
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            placeholder={'例如：\nKeil µVision5（MDK-ARM）+ STM32F103 器件包\nArduino IDE 2.x + Servo / NewPing 库\n供电：9V 电池 + 7805 稳压'}
          />
          <div className="pc-editor-foot">
            <button
              className="pc-btn pc-btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await getStore().updateProject(projectId, { codeNote: env.slice(0, 600) });
                  setMsg('开发环境说明存好了');
                  onChange?.();
                } finally {
                  setBusy(false);
                }
              }}
            >
              保存
            </button>
            <span className="pc-hint">这一段会跟着作品一起传给别人</span>
          </div>
          {codeNote.trim() && env.trim() === codeNote.trim() && (
            <div className="pc-env-view">
              <p className="pc-group-title">现在的说明</p>
              <pre className="pc-code pc-code-env"><code>{codeNote}</code></pre>
            </div>
          )}
        </>
      )}

      {msg && <p className="pc-msg">{msg}</p>}

      <style jsx global>{`
        .pc-wrap { margin-top: 22px; }
        .pc-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.07); padding-bottom: 10px; }
        .pc-tab { display: inline-flex; align-items: center; gap: 7px; padding: 8px 15px; border-radius: 9px; font-size: 13px; font-weight: 700; cursor: pointer; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); color: rgba(255,255,255,0.6); font-family: inherit; }
        .pc-tab-on { background: rgba(102,126,234,0.16); border-color: rgba(102,126,234,0.45); color: #dbe4ff; }
        .pc-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .pc-sub { margin: 0 0 12px; font-size: 12.5px; line-height: 1.8; color: rgba(255,255,255,0.45); }
        .pc-count { font-size: 11.5px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); }
        .pc-head-actions { display: flex; gap: 8px; }
        .pc-btn { display: inline-flex; align-items: center; padding: 8px 14px; border-radius: 9px; font-size: 12.5px; font-weight: 600; cursor: pointer; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); font-family: inherit; }
        .pc-btn-primary { background: linear-gradient(135deg, #667eea 0%, #7c5cf0 100%); border-color: transparent; color: #fff; }
        .pc-btn-soft { background: rgba(79,124,255,0.14); border-color: rgba(79,124,255,0.32); color: #bcd0ff; }
        .pc-btn:disabled { opacity: 0.55; cursor: default; }
        .pc-editor { padding: 14px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.09); margin-bottom: 14px; }
        .pc-editor-row { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
        .pc-inline-form { display: flex; gap: 9px; align-items: center; flex-wrap: wrap; }
        .pc-inline-form .pc-input { flex: 1 1 180px; min-width: 120px; }
        .pc-input { padding: 9px 12px; border-radius: 9px; font-size: 13px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: #fff; outline: none; font-family: inherit; box-sizing: border-box; }
        .pc-input:focus { border-color: rgba(102,126,234,0.55); }
        .pc-input-sm { flex: 0 1 130px !important; }
        .pc-input-full { width: 100%; margin-bottom: 10px; }
        .pc-select { flex: 0 0 150px; }
        .pc-arrow { color: rgba(255,255,255,0.35); }
        .pc-textarea { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 10px; font-size: 12.5px; line-height: 1.7; font-family: ui-monospace, Consolas, monospace; background: rgba(6,10,20,0.75); border: 1px solid rgba(255,255,255,0.12); color: #e6edf3; outline: none; resize: vertical; }
        .pc-textarea-sm { font-family: inherit; font-size: 13px; }
        .pc-editor-foot { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
        .pc-hint { font-size: 11.5px; color: rgba(255,255,255,0.35); }
        .pc-empty { margin: 0; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); font-size: 12.5px; line-height: 1.9; color: rgba(255,255,255,0.45); }
        .pc-empty code { font-family: ui-monospace, monospace; font-size: 11.5px; color: #a5b4fc; }
        .pc-body { display: grid; gap: 12px; grid-template-columns: 1fr; }
        @media (min-width: 760px) { .pc-body { grid-template-columns: 240px minmax(0, 1fr); } }
        .pc-list { display: flex; flex-direction: column; gap: 12px; }
        .pc-group ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
        .pc-group-title { margin: 0 0 6px; font-size: 11.5px; font-weight: 700; color: rgba(255,255,255,0.4); letter-spacing: 0.5px; }
        .pc-item { display: flex; flex-direction: column; gap: 3px; width: 100%; text-align: left; padding: 9px 11px; border-radius: 10px; cursor: pointer; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); font-family: inherit; }
        .pc-item-on { background: rgba(102,126,234,0.12); border-color: rgba(102,126,234,0.4); }
        .pc-item-name { font-size: 12.5px; font-weight: 700; color: #fff; word-break: break-all; }
        .pc-item-meta { font-size: 11px; color: rgba(255,255,255,0.42); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pc-view { min-width: 0; border-radius: 12px; border: 1px solid rgba(255,255,255,0.09); overflow: hidden; }
        .pc-view-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 9px 12px; background: rgba(255,255,255,0.04); flex-wrap: wrap; }
        .pc-view-name { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; color: #dbe4ff; }
        .pc-view-tag { font-size: 10.5px; font-weight: 600; padding: 1px 7px; border-radius: 999px; background: rgba(102,126,234,0.18); color: #bcd0ff; }
        .pc-view-actions { display: flex; gap: 6px; }
        .pc-mini { padding: 5px 10px; border-radius: 7px; font-size: 11.5px; font-weight: 600; cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.8); font-family: inherit; }
        .pc-mini-danger { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #fca5a5; }
        .pc-code { margin: 0; padding: 14px; max-height: 420px; overflow: auto; background: rgba(6,10,20,0.8); font-family: ui-monospace, Consolas, monospace; font-size: 12px; line-height: 1.75; color: #d7e3f4; white-space: pre; }
        .pc-code-env { max-height: none; }
        .pc-table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid rgba(255,255,255,0.09); }
        .pc-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .pc-table th { text-align: left; padding: 10px 12px; font-size: 11.5px; font-weight: 700; color: rgba(255,255,255,0.45); background: rgba(255,255,255,0.04); white-space: nowrap; }
        .pc-table td { padding: 4px 6px; border-top: 1px solid rgba(255,255,255,0.06); }
        .pc-cell { width: 100%; box-sizing: border-box; padding: 7px 9px; border-radius: 7px; font-size: 12.5px; background: transparent; border: 1px solid transparent; color: rgba(255,255,255,0.85); outline: none; font-family: inherit; }
        .pc-cell:hover { border-color: rgba(255,255,255,0.12); }
        .pc-cell:focus { background: rgba(255,255,255,0.05); border-color: rgba(102,126,234,0.5); }
        .pc-cell-strong { color: #bcd0ff; font-weight: 700; }
        .pc-debugs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .pc-debug { padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); }
        .pc-debug-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .pc-debug-problem { font-size: 13px; font-weight: 700; color: #fcd34d; }
        .pc-debug-solution { margin: 6px 0 0; font-size: 12.5px; line-height: 1.85; color: rgba(255,255,255,0.62); white-space: pre-wrap; }
        .pc-env-view { margin-top: 14px; }
        .pc-msg { margin: 10px 0 0; font-size: 12.5px; color: #6ee7b7; }
      `}</style>
    </div>
  );
}
