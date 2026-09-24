'use client';

import { useEffect } from 'react';

// 生产环境下注册 Service Worker（PWA 可安装）
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 非安全上下文（如局域网 http）下注册会失败，忽略即可
    });
  }, []);

  return null;
}
