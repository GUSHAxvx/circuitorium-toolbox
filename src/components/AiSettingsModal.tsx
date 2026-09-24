'use client';

import { useEffect, useState } from 'react';
import QRCodeBox from '@/components/QRCodeBox';
import {
  DEFAULT_AI_CONFIG,
  decodeTeacherCode,
  encodeTeacherCode,
  isAiReady,
  loadAiConfig,
  saveAiConfig,
  type AiConfig,
  type AiMode,
} from '@/lib/ai/config';
import { checkAiConnection } from '@/lib/ai/recognize';

interface Props {
  onClose: () => void;
  onSaved?: (config: AiConfig) => void;
}

const MODE_LABELS: Array<{ key: AiMode; title: string; desc: string }> = [
  { key: 'manual', title: '手动录入', desc: '默认。自己填元件名称与型号，不需要任何配置' },
  { key: 'local-key', title: '本机配置', desc: '自己填一个识别服务的地址和凭据，只存在这台电脑上' },
  { key: 'teacher-code', title: '老师配置码', desc: '粘贴老师给的配置码，或用手机扫老师的二维码' },
];

// AI 设置（可选）：不配置也能完整使用工具箱
export default function AiSettingsModal({ onClose, onSaved }: Props) {
  const [config, setConfig] = useState<AiConfig>(DEFAULT_AI_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [codeMsg, setCodeMsg] = useState('');
  const [teacherUrl, setTeacherUrl] = useState('');
  const [teacherToken, setTeacherToken] = useState('');
  const [teacherModel, setTeacherModel] = useState('qwen3-vl-plus');
  const [generated, setGenerated] = useState('');

  useEffect(() => {
    (async () => {
      const cfg = await loadAiConfig();
      setConfig(cfg);
      setTeacherUrl(cfg.baseUrl);
      setLoaded(true);
    })();
  }, []);

  const save = async (next: AiConfig) => {
    await saveAiConfig(next);
    setConfig(next);
    onSaved?.(next);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestMsg('');
    const res = await checkAiConnection(config);
    setTestMsg((res.ok ? '✅ ' : '⚠️ ') + res.message);
    setTesting(false);
  };

  const handleApplyStudentCode = () => {
    const payload = decodeTeacherCode(studentCode);
    if (!payload) {
      setCodeMsg('⚠️ 配置码看不懂，请确认复制完整（以 CT1- 开头）');
      return;
    }
    const next: AiConfig = {
      ...config,
      mode: 'teacher-code',
      baseUrl: payload.u,
      model: payload.m,
      proxyToken: payload.t,
      apiKey: '',
    };
    void save(next);
    setCodeMsg('✅ 已应用，可以拍照识别了');
  };

  if (!loaded) return null;

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '9px', fontSize: '13px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', outline: 'none',
  };

  return (
    <div className="ai-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ai-head">
          <div>
            <h2>识别设置</h2>
            <p>可选功能 · 不配置也能用手动录入，工具箱其余功能不受影响</p>
          </div>
          <button className="ai-close" onClick={onClose} aria-label="关闭">✕</button>
        </header>

        <div className="ai-modes">
          {MODE_LABELS.map((m) => (
            <button
              key={m.key}
              className={`ai-mode${config.mode === m.key ? ' ai-mode-active' : ''}`}
              onClick={() => void save({ ...config, mode: m.key })}
            >
              <span className="ai-mode-title">{m.title}</span>
              <span className="ai-mode-desc">{m.desc}</span>
            </button>
          ))}
        </div>

        {config.mode === 'manual' && (
          <div className="ai-panel">
            <p className="ai-note">
              当前是手动模式：在项目里点「＋ 添加元件」自己填名称、型号、数量即可。所有本地功能（作品文件、做同款、图片、教程）都不受限制。
            </p>
          </div>
        )}

        {config.mode === 'local-key' && (
          <div className="ai-panel">
            <label className="ai-label">识别服务地址</label>
            <input style={fieldStyle} value={config.baseUrl} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })} placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
            <label className="ai-label">识别凭据（只保存在这台电脑上）</label>
            <input style={fieldStyle} type="password" value={config.apiKey} onChange={(e) => setConfig({ ...config, apiKey: e.target.value })} placeholder="sk-..." />
            <label className="ai-label">模型名</label>
            <input style={fieldStyle} value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })} placeholder="qwen3-vl-plus" />
            <div className="ai-row">
              <button className="ai-btn ai-btn-primary" onClick={() => void save(config)}>保存</button>
              <button className="ai-btn ai-btn-ghost" onClick={handleTest} disabled={testing}>{testing ? '测试中…' : '测试连接'}</button>
              {testMsg && <span className="ai-msg">{testMsg}</span>}
            </div>
            <p className="ai-note">
              提示：浏览器里直连第三方识别服务可能被跨域限制挡住；如果测试连接失败，改用老师配置码（走代理）通常可用。
            </p>
          </div>
        )}

        {config.mode === 'teacher-code' && (
          <>
            <div className="ai-panel">
              <h3 className="ai-sub">我是学生：粘贴配置码</h3>
              <input style={fieldStyle} value={studentCode} onChange={(e) => setStudentCode(e.target.value)} placeholder="CT1-..." />
              <div className="ai-row">
                <button className="ai-btn ai-btn-primary" onClick={handleApplyStudentCode}>应用配置码</button>
                {codeMsg && <span className="ai-msg">{codeMsg}</span>}
              </div>
              {isAiReady(config) && (
                <p className="ai-note">当前已配置：{config.model}（{config.baseUrl}）</p>
              )}
            </div>

            <div className="ai-panel ai-panel-teacher">
              <h3 className="ai-sub">我是老师：生成配置码发给学生</h3>
              <label className="ai-label">代理地址（部署好的云函数地址）</label>
              <input style={fieldStyle} value={teacherUrl} onChange={(e) => setTeacherUrl(e.target.value)} placeholder="https://xxx.workers.dev/v1" />
              <label className="ai-label">访问令牌（自己定一串，学生凭它使用）</label>
              <input style={fieldStyle} value={teacherToken} onChange={(e) => setTeacherToken(e.target.value)} placeholder="class-2026-abc" />
              <label className="ai-label">模型名</label>
              <input style={fieldStyle} value={teacherModel} onChange={(e) => setTeacherModel(e.target.value)} />
              <div className="ai-row">
                <button
                  className="ai-btn ai-btn-soft"
                  onClick={() => setGenerated(encodeTeacherCode({ u: teacherUrl, t: teacherToken, m: teacherModel }))}
                  disabled={!teacherUrl.trim() || !teacherToken.trim()}
                >
                  生成配置码
                </button>
              </div>
              {generated && (
                <div className="ai-code">
                  <p className="ai-note">把这个码（或右边的二维码）发给学生：学生扫一下就能用，里面<b>不含你的真凭据</b>。</p>
                  <div className="ai-code-row">
                    <textarea readOnly value={generated} rows={3} style={{ ...fieldStyle, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px' }} />
                    <QRCodeBox text={generated} size={128} />
                  </div>
                </div>
              )}
              <p className="ai-note">
                真凭据放在云函数的环境变量里（见项目里的 `代理部署说明.md`），配置码里只有代理地址、令牌和模型名；令牌随时可以换。
              </p>
            </div>
          </>
        )}

        <footer className="ai-foot">
          <span className="ai-status">
            当前：{config.mode === 'manual' ? '手动录入' : config.mode === 'local-key' ? '本机配置' : '老师配置码'}
            {isAiReady(config) ? ' · 可拍照识别' : ' · 仅手动录入'}
          </span>
          <button className="ai-btn ai-btn-ghost" onClick={onClose}>完成</button>
        </footer>

        <style jsx global>{`
          .ai-overlay { position: fixed; inset: 0; z-index: 400; background: rgba(4,7,14,0.78); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 18px; }
          .ai-modal { width: min(680px, 100%); max-height: 90vh; overflow-y: auto; background: #0d1626; border: 1px solid rgba(120,150,255,0.18); border-radius: 16px; padding: 18px; box-shadow: 0 30px 70px rgba(0,0,0,0.55); }
          .ai-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
          .ai-head h2 { margin: 0 0 4px; font-size: 16px; font-weight: 800; color: #fff; }
          .ai-head p { margin: 0; font-size: 12.5px; color: rgba(255,255,255,0.45); }
          .ai-close { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; }
          .ai-modes { display: grid; gap: 10px; grid-template-columns: 1fr; margin-bottom: 14px; }
          @media (min-width: 640px) { .ai-modes { grid-template-columns: repeat(3, 1fr); } }
          .ai-mode { text-align: left; padding: 11px 12px; border-radius: 11px; cursor: pointer; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); }
          .ai-mode-active { background: rgba(79,124,255,0.12); border-color: rgba(79,124,255,0.42); }
          .ai-mode-title { display: block; font-size: 13px; font-weight: 700; color: #e8eeff; margin-bottom: 4px; }
          .ai-mode-desc { display: block; font-size: 11.5px; line-height: 1.6; color: rgba(255,255,255,0.45); }
          .ai-panel { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
          .ai-panel-teacher { border-color: rgba(167,139,250,0.24); background: rgba(167,139,250,0.05); }
          .ai-sub { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #dbe4ff; }
          .ai-label { display: block; font-size: 12px; color: rgba(255,255,255,0.5); margin: 10px 0 6px; }
          .ai-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
          .ai-btn { padding: 9px 16px; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
          .ai-btn-primary { background: linear-gradient(135deg, #3b6bff, #4f7cff); color: #fff; }
          .ai-btn-primary:disabled { opacity: 0.55; cursor: default; }
          .ai-btn-ghost { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.14); }
          .ai-btn-soft { background: rgba(167,139,250,0.14); color: #d6c8ff; border-color: rgba(167,139,250,0.34); }
          .ai-btn-soft:disabled { opacity: 0.5; cursor: default; }
          .ai-msg { font-size: 12.5px; color: #bcd0ff; }
          .ai-note { margin: 10px 0 0; font-size: 12px; line-height: 1.75; color: rgba(255,255,255,0.45); }
          .ai-code { margin-top: 12px; }
          .ai-code-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
          .ai-code-row textarea { flex: 1 1 260px; resize: vertical; }
          .ai-foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
          .ai-status { font-size: 12px; color: rgba(255,255,255,0.45); }
        `}</style>
      </div>
    </div>
  );
}
