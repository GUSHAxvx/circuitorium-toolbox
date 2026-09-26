'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useIsMobile from '@/hooks/useIsMobile';
import { headerStyle, logoStyle } from '@/styles/theme';

interface LinkItem {
  href: string;
  label: string;
}

interface SiteHeaderProps {
  links?: LinkItem[];
  right?: React.ReactNode;
  /** 内容最大宽度（默认 1200，项目详情页等宽版页面可传 1400） */
  maxWidth?: number;
  /** 点左上角 logo 去哪（便携版里首页就是工具箱） */
  homeHref?: string;
}

// 全站统一导航：只放真实存在的入口
// 「工具箱」排第一：元件库、始解/卍解这些新功能都在那条路由里，服务器版用户也要能一眼找到
const defaultLinks: LinkItem[] = [
  { href: '/toolbox', label: '工具箱' },
  { href: '/projects', label: '项目' },
  { href: '/community', label: '社区' },
  { href: '/recognize', label: 'AI识别' },
  { href: '/templates', label: '模板' },
];

// 全站统一响应式头部：文字链接（无图标），移动端紧凑排列，当前页高亮
export default function SiteHeader({ links, right, maxWidth = 1200, homeHref = '/' }: SiteHeaderProps) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const navLinks = links ?? defaultLinks;

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header style={headerStyle}>
      <div style={{
        maxWidth: `${maxWidth}px`,
        margin: '0 auto',
        padding: isMobile ? '12px 16px' : '16px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
      }}>
        <Link href={homeHref} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}>
          <div style={isMobile ? { ...logoStyle, width: 32, height: 32, fontSize: 16, borderRadius: 10 } : logoStyle}>🔬</div>
          <span style={{
            fontSize: isMobile ? 17 : 22,
            fontWeight: 800,
            color: 'white',
            letterSpacing: '1px',
          }}>
            {isMobile ? 'CIR' : 'CIRCUITORIUM'}
          </span>
        </Link>
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 16 : 24,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}>
          {navLinks.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  paddingBottom: '5px',
                  color: active ? 'white' : 'rgba(255,255,255,0.66)',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: active ? 700 : 600,
                  flexShrink: 0,
                  transition: 'color 0.2s',
                }}
              >
                {l.label}
                {active && (
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: '2px',
                    borderRadius: '2px',
                    background: 'linear-gradient(90deg, #667eea 0%, #22d3ee 100%)',
                  }} />
                )}
              </Link>
            );
          })}
          {right}
        </nav>
      </div>
    </header>
  );
}
