'use client';

// 关于与鸣谢：署名、数据位置、版本信息都放这里
// 为什么单独放一个弹层：元件库、作品页这些地方不该出现第三方名称与技术词，
// 但图形素材的许可要求署名（CC BY-SA 3.0），所以统一收在这一页。

import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

export default function AboutModal({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ab-overlay" onClick={onClose}>
      <div className="ab-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ab-head">
          <div>
            <h2>关于这个工具箱</h2>
            <p>版本 1.0 · 本地优先的电子工具箱</p>
          </div>
          <button className="ab-close" onClick={onClose} aria-label="关闭">✕</button>
        </header>

        <section className="ab-card">
          <h3>它是什么</h3>
          <p>
            从一个元器件，到完成一个项目。认元件、记清单、写教程、做作品，
            然后把作品打包发出去——对方双击就能看，收下就能改成自己的版本。
          </p>
        </section>

        <section className="ab-card">
          <h3>你的东西放在哪</h3>
          <p>
            作品、元件、图片、教程都存在这台电脑上，不上传、不需要登录、断网也能用。
            换电脑时用「分享作品 → 保存作品文件」把作品带走。
          </p>
        </section>

        <section className="ab-card ab-credits">
          <h3>鸣谢</h3>
          <ul>
            <li>
              <b>元件图形</b>来自 Fritzing 元件库（<code>github.com/fritzing/fritzing-parts</code>），
              采用 <b>CC BY-SA 3.0</b> 许可：署名并以相同方式共享。
              本工具箱把其中的元件图整理成白底方图用于教学，图形的衍生作品继续以同一许可提供。
            </li>
            <li>元件技术参数（型号、封装、引脚）同样整理自该元件库。</li>
            <li>教学文案由 AI 起草、人工校对；发现讲错的地方，欢迎指出。</li>
            <li>界面与打包基于 Next.js、React、Dexie、Tauri 等开源项目。</li>
          </ul>
        </section>

        <footer className="ab-foot">
          <button className="ab-btn ab-btn-ghost" onClick={onClose}>知道了</button>
        </footer>

        <style jsx global>{`
          .ab-overlay { position: fixed; inset: 0; z-index: 460; background: rgba(4,7,14,0.78); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 18px; }
          .ab-modal { width: min(620px, 100%); max-height: 88vh; overflow-y: auto; background: #0d1626; border: 1px solid rgba(120,150,255,0.18); border-radius: 16px; padding: 18px; box-shadow: 0 30px 70px rgba(0,0,0,0.55); }
          .ab-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
          .ab-head h2 { margin: 0 0 4px; font-size: 16px; font-weight: 800; color: #fff; }
          .ab-head p { margin: 0; font-size: 12.5px; color: rgba(255,255,255,0.45); }
          .ab-close { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; }
          .ab-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
          .ab-card h3 { margin: 0 0 8px; font-size: 13.5px; font-weight: 700; color: #dbe4ff; }
          .ab-card p { margin: 0; font-size: 12.5px; line-height: 1.8; color: rgba(255,255,255,0.6); }
          .ab-credits ul { margin: 0; padding-left: 18px; }
          .ab-credits li { font-size: 12.5px; line-height: 1.9; color: rgba(255,255,255,0.6); margin-bottom: 6px; }
          .ab-credits b { color: rgba(255,255,255,0.85); }
          .ab-credits code { font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; color: #a5b4fc; }
          .ab-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
          .ab-btn { padding: 9px 16px; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); }
          .ab-btn-ghost:hover { background: rgba(255,255,255,0.09); }
        `}</style>
      </div>
    </div>
  );
}
