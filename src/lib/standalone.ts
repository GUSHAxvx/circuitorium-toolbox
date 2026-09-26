// 判断当前跑的是哪种形态
//
//   独立版（便携版 / 桌面版）：只有工具箱这一页，不联网、没有服务器
//   服务器版（npm run dev / npm start）：工具箱只是站点里的一个页面
//
// 用编译期注入的 NEXT_PUBLIC_STANDALONE 判断（next.config.ts 里按 TOOLBOX_EXPORT 写入），
// 这样静态导出里永远只会渲染「工具箱」一个入口，不会链到不存在的页面。

export const IS_STANDALONE = process.env.NEXT_PUBLIC_STANDALONE === '1';

/** 工具箱页里给 SiteHeader 用的导航：独立版只有工具箱；服务器版保留全站入口 */
export const TOOLBOX_NAV = IS_STANDALONE
  ? [{ href: '/toolbox', label: '工具箱' }]
  : [
      { href: '/toolbox', label: '工具箱' },
      { href: '/projects', label: '项目' },
      { href: '/community', label: '社区' },
      { href: '/templates', label: '模板' },
    ];

/** 点 logo 去哪：独立版回工具箱，服务器版回首页 */
export const TOOLBOX_HOME = IS_STANDALONE ? '/toolbox' : '/';
