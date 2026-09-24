import type { CSSProperties } from 'react';

// ===== 通用页面骨架（历史/收藏/分享） =====
export const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#0a0a18',
  position: 'relative',
  overflow: 'hidden',
};

export const bgGradient: CSSProperties = {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'radial-gradient(ellipse at 50% 0%, #16163a 0%, #0a0a18 50%, #06060f 100%)',
};

export const gridBg: CSSProperties = {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundImage: `
    linear-gradient(rgba(124, 138, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(124, 138, 255, 0.04) 1px, transparent 1px)
  `,
  backgroundSize: '50px 50px',
};

export const loadingStyle: CSSProperties = {
  color: 'white',
  textAlign: 'center',
  paddingTop: '100px',
  fontSize: '18px',
};

export const headerStyle: CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0,
  zIndex: 100,
  background: 'rgba(10, 10, 24, 0.72)',
  backdropFilter: 'blur(20px)',
  borderBottom: '1px solid rgba(124, 138, 255, 0.12)',
};

export const navLink: CSSProperties = {
  color: 'rgba(255,255,255,0.7)',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '14px',
  padding: '8px 16px',
  borderRadius: '8px',
  background: 'rgba(102,126,234,0.1)',
  border: '1px solid rgba(102,126,234,0.2)',
  display: 'inline-flex',
  alignItems: 'center',
  transition: 'all 0.3s',
};

export const footer: CSSProperties = {
  textAlign: 'center',
  padding: '30px',
  color: 'rgba(255,255,255,0.3)',
  fontSize: '14px',
  borderTop: '1px solid rgba(255,255,255,0.05)',
};

// ===== 品牌 Logo（历史/收藏/分享页头） =====
export const logoStyle: CSSProperties = {
  width: '40px',
  height: '40px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
};

export const logoText: CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  color: 'white',
  letterSpacing: '1px',
};

// ===== 卡片列表（历史/收藏） =====
export const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
  gap: '24px',
};

export const card: CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  borderRadius: '20px',
  border: '1px solid rgba(255,255,255,0.05)',
  overflow: 'hidden',
  transition: 'all 0.3s',
};

export const cardImageWrapper: CSSProperties = {
  position: 'relative',
  aspectRatio: '16/10',
  background: '#1a1a3e',
};

export const cardImage: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
};

export const cardBadge: CSSProperties = {
  position: 'absolute',
  top: '10px',
  right: '10px',
  background: 'rgba(16, 185, 129, 0.9)',
  color: 'white',
  padding: '4px 10px',
  borderRadius: '20px',
  fontSize: '13px',
  fontWeight: 600,
};

export const cardContent: CSSProperties = {
  padding: '20px',
};

export const cardTitle: CSSProperties = {
  fontWeight: 700,
  color: 'white',
  fontSize: '18px',
  marginBottom: '4px',
};

export const cardType: CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: '14px',
};

export const cardDesc: CSSProperties = {
  color: 'rgba(255,255,255,0.6)',
  fontSize: '14px',
  lineHeight: 1.6,
  marginBottom: '12px',
};

export const emptyState: CSSProperties = {
  textAlign: 'center',
  padding: '80px 20px',
  color: 'rgba(255,255,255,0.6)',
};

// ===== 登录/注册 =====
export const authPageStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#0a0a18',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 20px',
  position: 'relative',
  overflow: 'hidden',
};

export const authLogoStyle: CSSProperties = {
  width: '48px',
  height: '48px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  borderRadius: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '24px',
  boxShadow: '0 8px 30px rgba(102, 126, 234, 0.4)',
};

export const authLogoText: CSSProperties = {
  fontSize: '26px',
  fontWeight: 800,
  color: 'white',
  letterSpacing: '2px',
};

export const authCard: CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  borderRadius: '24px',
  border: '1px solid rgba(255,255,255,0.05)',
  padding: '40px',
  boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
};

export const cardHeader: CSSProperties = {
  textAlign: 'center',
  marginBottom: '30px',
};

export const authCardTitle: CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: 'white',
  marginBottom: '8px',
};

export const authCardDesc: CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: '15px',
};

export const errorBox: CSSProperties = {
  background: 'rgba(239, 68, 68, 0.1)',
  color: '#ef4444',
  padding: '14px 18px',
  borderRadius: '12px',
  marginBottom: '20px',
  fontSize: '14px',
  border: '1px solid rgba(239, 68, 68, 0.2)',
};

export const label: CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.8)',
  marginBottom: '8px',
};

export const authInput: CSSProperties = {
  width: '100%',
  padding: '14px 18px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  fontSize: '15px',
  color: 'white',
  outline: 'none',
  transition: 'all 0.3s',
};

export const submitBtn: CSSProperties = {
  width: '100%',
  padding: '16px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  fontSize: '16px',
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: '10px',
  boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
  transition: 'all 0.3s',
};

export const authFooter: CSSProperties = {
  marginTop: '28px',
  textAlign: 'center',
  fontSize: '14px',
};

export const link: CSSProperties = {
  color: '#667eea',
  textDecoration: 'none',
  fontWeight: 600,
};

export const backLink: CSSProperties = {
  textAlign: 'center',
  marginTop: '30px',
};

export const backLinkText: CSSProperties = {
  color: 'rgba(255,255,255,0.4)',
  textDecoration: 'none',
  fontSize: '14px',
};
