'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveAuth } from '@/lib/client';
import {
  authPageStyle, bgGradient, gridBg,
  authLogoStyle, authLogoText, authCard, cardHeader,
  authCardTitle, authCardDesc, errorBox, label, authInput,
  submitBtn, authFooter, link, backLink, backLinkText,
} from '@/styles/theme';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '登录失败');
        return;
      }

      saveAuth(data.token, data.user);
      router.push('/');
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '演示登录失败');
        return;
      }
      saveAuth(data.token, data.user);
      router.push(data.projectId ? `/projects/${data.projectId}` : '/projects');
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
      
      {/* 装饰 */}
      <div style={decor1}>🔬</div>
      <div style={decor2}>⚡</div>

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <div style={authLogoStyle}>🔬</div>
            <span style={authLogoText}>CIRCUITORIUM</span>
          </Link>
        </div>

        <div style={authCard}>
          <div style={cardHeader}>
            <h2 style={authCardTitle}>欢迎回来</h2>
            <p style={authCardDesc}>登录您的账户</p>
          </div>

          <form onSubmit={handleSubmit}>
            {error && <div style={errorBox}>{error}</div>}

            <div style={inputGroup}>
              <label style={label}>用户名 / 邮箱</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={authInput}
                placeholder="请输入用户名或邮箱"
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
                placeholder="请输入密码"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={submitBtn}
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          <div style={authFooter}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>还没有账户？</span>
            {' '}
            <Link href="/register" style={link}>立即注册</Link>
          </div>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 0 16px' }} />
            <button
              onClick={handleDemoLogin}
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: 'rgba(16,185,129,0.1)',
                color: '#6ee7b7',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
              }}
            >
              🎓 课程演示：使用演示账号一键进入
            </button>
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
  top: '15%',
  left: '10%',
  fontSize: '120px',
  opacity: 0.03,
};

const decor2: React.CSSProperties = {
  position: 'absolute',
  bottom: '20%',
  right: '10%',
  fontSize: '100px',
  opacity: 0.03,
};

const inputGroup: React.CSSProperties = {
  marginBottom: '20px',
};
