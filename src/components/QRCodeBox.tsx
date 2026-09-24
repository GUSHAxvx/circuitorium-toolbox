'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  text: string;
  size?: number;
}

// 本地生成二维码（无外部依赖网络）
export default function QRCodeBox({ text, size = 160 }: Props) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      color: { dark: '#0f1226', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, [text, size]);

  if (!dataUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.3)',
          fontSize: '12px',
        }}
      >
        生成中...
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="二维码"
      width={size}
      height={size}
      style={{ borderRadius: '12px', display: 'block' }}
    />
  );
}
