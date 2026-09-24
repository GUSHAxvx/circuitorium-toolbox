'use client';

import Link from 'next/link';
import CameraCapture from '@/components/CameraCapture';
import SiteHeader from '@/components/SiteHeader';
import {
  pageStyle, bgGradient, gridBg, footer,
} from '@/styles/theme';

export default function RecognizePage() {
  return (
    <div style={pageStyle}>
      <div style={bgGradient} />
      <div style={gridBg} />

      <SiteHeader />

      <main style={{ maxWidth: '860px', margin: '0 auto', padding: 'clamp(92px, 13vh, 120px) clamp(16px, 5vw, 40px) 80px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ color: 'white', fontWeight: 800, fontSize: 'clamp(24px, 6vw, 30px)', margin: '0 0 10px' }}>📷 元器件识别</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', lineHeight: 1.8, margin: 0 }}>
            拍照或上传图片，AI 生成完整元件档案：类型、型号、封装、引脚、规格参数
          </p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(102,126,234,0.45), rgba(34,211,238,0.12), rgba(167,139,250,0.3))',
          borderRadius: '28px',
          padding: '1px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 0 60px rgba(102,126,234,0.12)',
        }}>
          <div style={{
            background: '#10122b',
            borderRadius: '27px',
            padding: 'clamp(16px, 5vw, 32px)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <CameraCapture />
          </div>
        </div>
      </main>

      <footer style={footer}>
        <p>© 2026 CIRCUITORIUM — 让电子知识不再碎片化</p>
      </footer>
    </div>
  );
}
