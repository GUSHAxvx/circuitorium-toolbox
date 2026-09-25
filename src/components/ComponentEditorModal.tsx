'use client';

// 自己加一个元件 / 补充元件资料
// - 新建：source = user_created
// - 改已有的：只允许改自己加的（内置的可以「复制一份再改」，不会污染内置数据）
// 图片会在保存前自动压缩（复用工具箱那套图片处理）

import { useEffect, useRef, useState } from 'react';
import { getStore } from '@/lib/store';
import { compressImage } from '@/lib/images';
import { LIBRARY_CATEGORIES } from '@/lib/library/builtin';
import type { LibraryComponent } from '@/lib/store/types';

interface Props {
  /** 传了就是编辑，不传就是新建 */
  editing?: LibraryComponent | null;
  /** 从内置元件"复制一份再改"时的来源 */
  copyFrom?: LibraryComponent | null;
  onSaved: (id: string, isNew: boolean) => void;
  onClose: () => void;
}

interface Form {
  name: string;
  category: string;
  purpose: string;
  appearance: string;
  polarity: string;
  howToRead: string;
  commonModels: string;
  commonMistakes: string;
  usedInProjects: string;
  tags: string;
  pinCount: string;
  package: string;
}

const EMPTY: Form = {
  name: '', category: '基础元件', purpose: '', appearance: '', polarity: '', howToRead: '',
  commonModels: '', commonMistakes: '', usedInProjects: '', tags: '', pinCount: '', package: '',
};

function toForm(item: LibraryComponent): Form {
  return {
    name: item.name || '',
    category: LIBRARY_CATEGORIES.includes(item.category as never) ? item.category : '基础元件',
    purpose: item.purpose || '',
    appearance: item.appearance || '',
    polarity: item.polarity || '',
    howToRead: item.howToRead || '',
    commonModels: (item.commonModels || []).join('、'),
    commonMistakes: (item.commonMistakes || []).join('\n'),
    usedInProjects: (item.usedInProjects || []).join('、'),
    tags: (item.tags || []).join('、'),
    pinCount: item.pinCount ? String(item.pinCount) : '',
    package: item.package || '',
  };
}

const splitList = (text: string, max: number, sep = /[、,，\s]+/) =>
  text.split(sep).map((s) => s.trim()).filter(Boolean).slice(0, max);

export default function ComponentEditorModal({ editing, copyFrom, onSaved, onClose }: Props) {
  const base = editing || copyFrom || null;
  const isEdit = !!editing;
  const [form, setForm] = useState<Form>(base ? toForm(base) : EMPTY);
  const [image, setImage] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(copyFrom && !editing ? null : editing?.imageUrl || null);
  const [imageNote, setImageNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => () => { if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setImageNote('正在处理图片…');
    try {
      const { blob, compressed, note } = await compressImage(file);
      setImage(blob);
      setImagePreview((old) => {
        if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      setImageNote(note ? (compressed ? `已压缩：${note}` : `图片 ${note}`) : '图片已经选好了');
    } catch {
      setImageNote('这张图读不了，换一张试试');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    if (!form.name.trim()) { setErr('先给它起个名字'); return; }
    if (!form.purpose.trim()) { setErr('写一句"它是干嘛的"吧，别人看元件库就靠这句'); return; }
    setBusy(true);
    setErr('');
    try {
      const store = getStore();
      // 编辑时 id 不变；新建/复制时让存储层生成（内置 id 不许占用）
      const id = isEdit
        ? editing!.id
        : undefined;
      const saved = await store.saveLibraryComponent({
        id,
        name: form.name.trim(),
        category: form.category,
        purpose: form.purpose.trim(),
        appearance: form.appearance.trim(),
        polarity: form.polarity.trim(),
        howToRead: form.howToRead.trim(),
        commonModels: splitList(form.commonModels, 5),
        commonMistakes: form.commonMistakes.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3),
        usedInProjects: splitList(form.usedInProjects, 3),
        tags: splitList(form.tags, 3),
        pinCount: Number(form.pinCount) || 0,
        package: form.package.trim(),
        // 图片：编辑时 undefined 表示"没动过，保留原图"
        ...(image ? { image } : isEdit ? {} : { image: null }),
        source: isEdit ? editing!.source : 'user_created',
        author: isEdit ? editing!.author : '我',
        verified: true,
        aliases: base?.aliases || [],
        family: base?.family || '',
        specs: base?.specs || {},
      });
      onSaved(saved, !isEdit);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, key: keyof Form, placeholder: string, textarea = false, rows = 2) => (
    <label className="ce-field">
      <span className="ce-label">{label}</span>
      {textarea ? (
        <textarea
          className="ce-input"
          rows={rows}
          value={form[key]}
          placeholder={placeholder}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      ) : (
        <input
          className="ce-input"
          value={form[key]}
          placeholder={placeholder}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      )}
    </label>
  );

  return (
    <div className="ce-overlay" onClick={onClose}>
      <div className="ce-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ce-head">
          <div>
            <h2>{isEdit ? `补充「${editing!.name}」的资料` : copyFrom ? `照着「${copyFrom.name}」做一个` : '自己加一个元件'}</h2>
            <p>{isEdit || copyFrom ? '改好之后，它会出现在元件库里，也能跟着作品传给别人' : '加进你的元件库，之后新建项目就能直接挑'}</p>
          </div>
          <button className="ce-close" onClick={onClose} aria-label="关闭">✕</button>
        </header>

        <div className="ce-body">
          <div className="ce-figure">
            <div className="ce-figure-box">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- 本地图片，blob 地址
                <img src={imagePreview} alt="" />
              ) : (
                <span className="ce-initial">{form.name.slice(0, 1) || '？'}</span>
              )}
            </div>
            <label className="ce-btn ce-btn-soft" style={{ cursor: 'pointer' }}>
              {imagePreview ? '换一张图' : '上传元件图'}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePick} disabled={busy} />
            </label>
            {imageNote && <span className="ce-note">{imageNote}</span>}
          </div>

          <div className="ce-fields">
            {field('名字', 'name', '例如：XYZ 模块')}
            <label className="ce-field">
              <span className="ce-label">分类</span>
              <select className="ce-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {LIBRARY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {field('它是干嘛的', 'purpose', '一句话，中学生能懂')}
            {field('怎么认出来', 'appearance', '长什么样、几个脚')}
            {field('正负极 / 方向', 'polarity', '有没有方向，怎么区分')}
            {field('怎么读参数', 'howToRead', '比如：看色环 / 看丝印')}
            {field('常见型号（用、隔开）', 'commonModels', 'XYZ-1、XYZ-2')}
            {field('引脚数', 'pinCount', '4')}
            {field('封装', 'package', 'DIP-4')}
            {field('能做的小项目（用、隔开）', 'usedInProjects', '小夜灯、报警器')}
            {field('新手常踩的坑（一行一条，最多 3 条）', 'commonMistakes', '插反了不工作', true, 3)}
          </div>
        </div>

        {err && <p className="ce-err">{err}</p>}

        <footer className="ce-foot">
          <button className="ce-btn ce-btn-primary" onClick={save} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
          <button className="ce-btn ce-btn-ghost" onClick={onClose}>取消</button>
        </footer>

        <style jsx global>{`
          .ce-overlay { position: fixed; inset: 0; z-index: 455; background: rgba(4,7,14,0.8); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 18px; }
          .ce-modal { width: min(760px, 100%); max-height: 90vh; overflow-y: auto; background: #0d1626; border: 1px solid rgba(120,150,255,0.18); border-radius: 16px; padding: 18px; box-shadow: 0 30px 70px rgba(0,0,0,0.55); }
          .ce-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
          .ce-head h2 { margin: 0 0 4px; font-size: 16px; font-weight: 800; color: #fff; }
          .ce-head p { margin: 0; font-size: 12.5px; color: rgba(255,255,255,0.45); }
          .ce-close { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; }
          .ce-body { display: grid; gap: 16px; grid-template-columns: 1fr; }
          @media (min-width: 680px) { .ce-body { grid-template-columns: 190px minmax(0, 1fr); } }
          .ce-figure { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
          .ce-figure-box { display: grid; place-items: center; aspect-ratio: 1 / 1; background: #fff; border-radius: 12px; overflow: hidden; }
          .ce-figure-box img { width: 100%; height: 100%; object-fit: contain; }
          .ce-initial { font-size: 44px; font-weight: 800; color: rgba(20,30,60,0.22); }
          .ce-note { font-size: 11.5px; color: rgba(255,255,255,0.4); text-align: center; }
          .ce-fields { display: grid; gap: 10px; }
          @media (min-width: 680px) { .ce-fields { grid-template-columns: 1fr 1fr; } }
          .ce-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
          .ce-label { font-size: 12px; color: rgba(255,255,255,0.5); }
          .ce-input { width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 9px; font-size: 13px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: #fff; outline: none; font-family: inherit; }
          .ce-input:focus { border-color: rgba(102,126,234,0.55); }
          .ce-btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); }
          .ce-btn-primary { background: linear-gradient(135deg, #667eea 0%, #7c5cf0 100%); border-color: transparent; color: #fff; }
          .ce-btn-soft { background: rgba(79,124,255,0.14); border-color: rgba(79,124,255,0.32); color: #bcd0ff; }
          .ce-btn:disabled { opacity: 0.55; cursor: default; }
          .ce-err { margin: 12px 0 0; font-size: 12.5px; color: #fca5a5; }
          .ce-foot { display: flex; gap: 10px; margin-top: 14px; }
        `}</style>
      </div>
    </div>
  );
}
