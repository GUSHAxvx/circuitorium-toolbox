'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  authPageStyle, bgGradient, gridBg,
  authLogoStyle, authLogoText, authCard, cardHeader,
  authCardTitle, authCardDesc, errorBox, label, authInput,
  submitBtn, authFooter, link, backLink, backLinkText,
} from '@/styles/theme';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '注册失败');
        return;
      }

      alert('注册成功，请登录');
      router.push('/login');
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={authPageStyle}>
      <div style={bgGradient} />
      <div style={gridBg} />
      
      <div style={decor1}>🔬</div>
      <div style={decor2}>💡</div>

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <div style={authLogoStyle}>🔬</div>
            <span style={authLogoText}>CIRCUITORIUM</span>
          </Link>
        </div>

        <div style={authCard}>
          <div style={cardHeader}>
            <h2 style={authCardTitle}>创建账户</h2>
            <p style={authCardDesc}>注册一个新账户</p>
          </div>

          <form onSubmit={handleSubmit}>
            {error && <div style={errorBox}>{error}</div>}

            <div style={inputGroup}>
              <label style={label}>用户名</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={authInput}
                placeholder="请输入用户名"
              />
            </div>
            
            <div style={inputGroup}>
              <label style={label}>邮箱</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={authInput}
                placeholder="请输入邮箱"
              />
            </div>
            
            <div style={inputGroup}>
              <label style={label}>密码</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={authInput}
                placeholder="请输入密码（至少6位）"
              />
            </div>

            <div style={inputGroup}>
              <label style={label}>确认密码</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={authInput}
                placeholder="请再次输入密码"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={submitBtn}
            >
              {loading ? '注册中...' : '注册'}
            </button>
          </form>

          <div style={authFooter}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>已有账户？</span>
            {' '}
            <Link href="/login" style={link}>立即登录</Link>
          </div>
        </div>

        <div style={backLink}>
          <Link href="/" style={backLinkText}>← 返回首页</Link>
        </div>
      </div>
    </div>
  );
}

// 以下共享样式见 @/styles/theme：authPageStyle、bgGradient、gridBg、authLogoStyle、authLogoText、authCard、cardHeader、authCardTitle、authCardDesc、errorBox、label、authInput、submitBtn、authFooter、link、backLink、backLinkText

const decor1: React.CSSProperties = {
  position: 'absolute',
  top: '20%',
  right: '10%',
  fontSize: '100px',
  opacity: 0.03,
};

const decor2: React.CSSProperties = {
  position: 'absolute',
  bottom: '15%',
  left: '10%',
  fontSize: '80px',
  opacity: 0.03,
};

const inputGroup: React.CSSProperties = {
  marginBottom: '18px',
};
