import type { MetadataRoute } from 'next';

// 静态导出（便携版）时，元数据路由必须显式声明为静态
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CIRCUITORIUM — 电子学习创作平台',
    short_name: 'CIRCUITORIUM',
    description: '从认识一个元件，到完成一个项目。让电子知识不再碎片化。',
    start_url: '/toolbox/',
    display: 'standalone',
    background_color: '#0a0a18',
    theme_color: '#0a0a18',
    lang: 'zh-CN',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
