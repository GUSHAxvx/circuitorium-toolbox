'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { authHeaders, getToken } from '@/lib/client';
import type { RecognitionResult } from '@/lib/types';

interface ProjectItem {
  id: number;
  name: string;
}

interface Props {
  onRecognize?: (result: RecognitionResult) => void;
}

export default function CameraCapture({ onRecognize }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useCamera, setUseCamera] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteMsg, setFavoriteMsg] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectMsg, setProjectMsg] = useState('');
  const [addingToProject, setAddingToProject] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    setUseCamera(false);
  }, []);

  // 组件卸载时停止摄像头
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleFileUpload = useCallback((file: File) => {
    setError('');
    setIsFavorited(false);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setLoading(true);

    (async () => {
      try {
        const formData = new FormData();
        formData.append('image', file);

        const headers: Record<string, string> = authHeaders();

        const res = await fetch('/api/recognize', {
          method: 'POST',
          headers,
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || '识别失败');
          return;
        }

        setResult(data.result);
        onRecognize?.(data.result);
      } catch {
        setError('网络错误，请重试');
      } finally {
        setLoading(false);
      }
    })();
  }, [onRecognize]);

  const startNativeCamera = () => {
    if (nativeInputRef.current) {
      nativeInputRef.current.click();
    }
  };

  const startWebRTCCamera = async () => {
    setError('');
    setCameraLoading(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (isMobile) {
        startNativeCamera();
        return;
      }
      setError('浏览器不支持摄像头访问，请使用上传图片');
      setCameraLoading(false);
      return;
    }

    try {
      const constraints = [
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        },
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        {
          video: {
            facingMode: 'environment'
          }
        },
        {
          video: true
        }
      ];

      let stream: MediaStream | null = null;
      let lastError: Error | null = null;

      for (const constraint of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint);
          if (stream) break;
        } catch (err) {
          if (err instanceof Error) lastError = err;
        }
      }

      if (!stream) {
        throw lastError || new Error('无法获取摄像头流');
      }

      streamRef.current = stream;

      if (videoRef.current) {
        if (videoRef.current.srcObject) {
          const oldTracks = (videoRef.current.srcObject as MediaStream).getTracks();
          oldTracks.forEach(track => track.stop());
        }

        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.setAttribute('playsinline', '');
        videoRef.current.setAttribute('webkit-playsinline', '');

        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('视频元素不存在'));
            return;
          }

          const timeout = setTimeout(() => reject(new Error('超时')), 8000);

          videoRef.current.onloadedmetadata = () => {
            clearTimeout(timeout);
            if (videoRef.current) {
              videoRef.current.play()
                .then(() => resolve())
                .catch(() => {
                  resolve();
                });
            }
          };

          videoRef.current.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('视频加载失败'));
          };
        });

        setUseCamera(true);
      }
    } catch (err) {
      console.error('摄像头访问错误:', err);
      let errorMsg = '无法访问摄像头';

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMsg = '摄像头权限被拒绝，请在浏览器设置中允许摄像头访问';
        } else if (err.name === 'NotFoundError') {
          errorMsg = '未找到摄像头设备';
        } else if (err.name === 'NotReadableError') {
          errorMsg = '摄像头被占用，请关闭其他使用摄像头的应用';
        } else if (err.name === 'OverconstrainedError') {
          errorMsg = '摄像头配置不支持';
        } else if (err.message.includes('超时')) {
          errorMsg = '摄像头启动超时，请重试';
        }
      }

      setError(errorMsg);
      if (isMobile) {
        setTimeout(() => {
          setError('');
          startNativeCamera();
        }, 1500);
      }
    } finally {
      setCameraLoading(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
          handleFileUpload(file);
        }
      },
      'image/jpeg',
      0.9
    );

    stopCamera();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileUpload(file);
  };

  const handleFavorite = async () => {
    if (!result) return;

    if (!getToken()) {
      setFavoriteMsg('请先登录');
      return;
    }

    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          image_path: result.imagePath,
          component_name: result.name,
          component_type: result.type,
          description: result.description,
          confidence: result.confidence,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsFavorited(true);
        setFavoriteMsg('收藏成功！');
      } else {
        setFavoriteMsg(data.error || '收藏失败');
      }
    } catch {
      setFavoriteMsg('收藏失败');
    }
  };

  const handleLoadProjects = async () => {
    if (!getToken()) {
      setProjectMsg('请先登录');
      return;
    }
    try {
      const res = await fetch('/api/projects', {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setProjects(data.projects || []);
        setShowProjectSelect(true);
      }
    } catch {
      setProjectMsg('加载项目失败');
    }
  };

  const handleAddToProject = async (projectId: number) => {
    if (!result) return;
    setAddingToProject(true);
    setProjectMsg('');

    if (!getToken()) {
      setProjectMsg('请先登录');
      setAddingToProject(false);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/components`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          image_path: result.imagePath,
          component_name: result.name,
          component_type: result.type,
          description: result.description,
          confidence: result.confidence,
          model: result.model || '',
          manufacturer: result.manufacturer || '',
          package_type: result.packageType || '',
          pin_count: result.pinCount || 0,
          specifications: result.specifications || '',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowProjectSelect(false);
        setProjectMsg('已加入项目！');
      } else {
        setProjectMsg(data.error || '加入失败');
      }
    } catch {
      setProjectMsg('网络错误');
    } finally {
      setAddingToProject(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <input
        ref={nativeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {!preview ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          {useCamera ? (
            <div style={{ position: 'relative', width: '100%' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', maxHeight: isMobile ? '300px' : '400px', objectFit: 'contain', borderRadius: isMobile ? '12px' : '16px', background: '#000', display: 'block' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div style={{ marginTop: isMobile ? '16px' : '20px', display: 'flex', justifyContent: 'center', gap: isMobile ? '12px' : '16px', flexWrap: 'wrap' }}>
                <button
                  onClick={capturePhoto}
                  style={{
                    padding: isMobile ? '14px 32px' : '16px 40px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50px',
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 10px 30px rgba(102, 126, 234, 0.5)',
                    transition: 'all 0.3s',
                  }}
                >
                  📸 拍照
                </button>
                <button
                  onClick={stopCamera}
                  style={{
                    padding: isMobile ? '14px 24px' : '16px 32px',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '50px',
                    fontSize: isMobile ? '14px' : '16px',
                    fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? '16px' : '20px', width: '100%', padding: isMobile ? '20px 16px' : '40px 20px' }}>
              <button
                onClick={isMobile ? startNativeCamera : startWebRTCCamera}
                disabled={cameraLoading && !isMobile}
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  padding: isMobile ? '24px 32px' : '30px 40px',
                  background: cameraLoading 
                    ? 'rgba(102, 126, 234, 0.5)' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: isMobile ? '16px' : '20px',
                  fontSize: isMobile ? '18px' : '22px',
                  fontWeight: 'bold',
                  cursor: cameraLoading && !isMobile ? 'not-allowed' : 'pointer',
                  boxShadow: cameraLoading ? 'none' : '0 15px 40px rgba(102, 126, 234, 0.5)',
                  transition: 'all 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isMobile ? '12px' : '16px',
                  opacity: cameraLoading ? 0.7 : 1,
                }}
              >
                {cameraLoading ? (
                  <>
                    <div style={{
                      width: isMobile ? '24px' : '28px',
                      height: isMobile ? '24px' : '28px',
                      border: '3px solid rgba(255,255,255,0.3)',
                      borderTop: '3px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span>启动中...</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: isMobile ? '28px' : '36px' }}>📷</span>
                    <span>{isMobile ? '拍照识别' : '打开摄像头拍照'}</span>
                  </>
                )}
              </button>

              {isMobile && (
                <button
                  onClick={startWebRTCCamera}
                  style={{
                    width: '100%',
                    maxWidth: '400px',
                    padding: isMobile ? '20px 32px' : '24px 40px',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.8)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: isMobile ? '16px' : '20px',
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: isMobile ? '10px' : '14px',
                    transition: 'all 0.3s',
                  }}
                >
                  <span style={{ fontSize: isMobile ? '24px' : '28px' }}>📹</span>
                  <span>浏览器内取景</span>
                </button>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '16px' : '20px', width: '100%', maxWidth: '400px' }}>
                <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, transparent, rgba(102,126,234,0.3), transparent)' }}></div>
                <span style={{ color: '#999', fontSize: isMobile ? '14px' : '16px' }}>或</span>
                <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, transparent, rgba(102,126,234,0.3), transparent)' }}></div>
              </div>
              
              <label style={{
                width: '100%',
                maxWidth: '400px',
                padding: isMobile ? '24px 32px' : '30px 40px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: isMobile ? '16px' : '20px',
                fontSize: isMobile ? '18px' : '22px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 15px 40px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isMobile ? '12px' : '16px',
              }}>
                <span style={{ fontSize: isMobile ? '28px' : '36px' }}>📁</span>
                <span>上传图片识别</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
              <p style={{ color: '#999', fontSize: isMobile ? '12px' : '14px', marginTop: '8px' }}>支持 JPG、PNG 格式，最大 10MB</p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
          <div style={{ position: 'relative' }}>
            <img
              src={preview}
              alt="预览"
              style={{ width: '100%', maxHeight: isMobile ? '250px' : '400px', objectFit: 'contain', borderRadius: isMobile ? '12px' : '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
            />
            <button
              onClick={() => {
                setPreview(null);
                setResult(null);
                setError('');
                setIsFavorited(false);
                setFavoriteMsg('');
              }}
              style={{
                position: 'absolute',
                top: isMobile ? '8px' : '12px',
                right: isMobile ? '8px' : '12px',
                padding: isMobile ? '8px 16px' : '10px 20px',
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                border: 'none',
                borderRadius: '25px',
                fontSize: isMobile ? '12px' : '14px',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
              }}
            >
              🔄 重新选择
            </button>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: isMobile ? '20px' : '30px' }}>
              <div style={{ 
                width: isMobile ? '50px' : '60px', 
                height: isMobile ? '50px' : '60px', 
                border: '4px solid rgba(102, 126, 234, 0.2)', 
                borderTop: '4px solid #667eea', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }}></div>
              <p style={{ marginTop: '16px', color: '#666', fontSize: isMobile ? '14px' : '16px' }}>AI 正在识别中...</p>
              <style jsx>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}

          {error && (
            <div style={{ background: '#fee', color: '#c33', padding: isMobile ? '12px' : '16px', borderRadius: isMobile ? '10px' : '12px', textAlign: 'center', fontSize: isMobile ? '14px' : '' }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ 
              background: 'white', 
              borderRadius: isMobile ? '12px' : '16px', 
              padding: isMobile ? '16px' : '24px', 
              boxShadow: '0 10px 40px rgba(0,0,0,0.1)' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isMobile ? '12px' : '16px', flexDirection: isMobile ? 'column' : 'row' }}>
                <div style={{ marginBottom: isMobile ? '12px' : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: 'bold', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                      {result.name}
                    </h3>
                    {result.model && (
                      <span style={{
                        padding: '2px 10px',
                        background: 'rgba(102,126,234,0.1)',
                        color: '#667eea',
                        borderRadius: '6px',
                        fontSize: isMobile ? '13px' : '14px',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                      }}>
                        {result.model}
                      </span>
                    )}
                  </div>
                  <p style={{ color: '#666', fontSize: isMobile ? '14px' : '16px', marginTop: '4px' }}>{result.type}</p>
                </div>
                <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                  <span style={{ fontSize: isMobile ? '28px' : '32px', fontWeight: 'bold', color: '#10b981' }}>
                    {(result.confidence * 100).toFixed(0)}%
                  </span>
                  <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#999' }}>置信度</p>
                </div>
              </div>

              {(result.model || result.manufacturer || result.packageType || (result.pinCount && result.pinCount > 0) || result.specifications) && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '8px', marginBottom: isMobile ? '12px' : '14px' }}>
                  {result.model && (
                    <div style={{ background: '#f0f4ff', borderRadius: '8px', padding: isMobile ? '8px 10px' : '10px 12px' }}>
                      <span style={{ fontSize: '10px', color: '#999', display: 'block', marginBottom: '2px' }}>型号/料号</span>
                      <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: 700, color: '#333', fontFamily: 'monospace' }}>{result.model}</span>
                    </div>
                  )}
                  {result.manufacturer && (
                    <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: isMobile ? '8px 10px' : '10px 12px' }}>
                      <span style={{ fontSize: '10px', color: '#999', display: 'block', marginBottom: '2px' }}>制造商</span>
                      <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: 700, color: '#333' }}>{result.manufacturer}</span>
                    </div>
                  )}
                  {result.packageType && (
                    <div style={{ background: '#fef3c7', borderRadius: '8px', padding: isMobile ? '8px 10px' : '10px 12px' }}>
                      <span style={{ fontSize: '10px', color: '#999', display: 'block', marginBottom: '2px' }}>封装</span>
                      <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: 700, color: '#333', fontFamily: 'monospace' }}>{result.packageType}{result.pinCount && result.pinCount > 0 ? `·${result.pinCount}脚` : ''}</span>
                    </div>
                  )}
                  {result.specifications && (
                    <div style={{ background: '#fdf2f8', borderRadius: '8px', padding: isMobile ? '8px 10px' : '10px 12px', gridColumn: result.model && result.manufacturer && result.packageType ? '1 / -1' : 'auto' }}>
                      <span style={{ fontSize: '10px', color: '#999', display: 'block', marginBottom: '2px' }}>规格参数</span>
                      <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: 600, color: '#333' }}>{result.specifications}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ background: '#f8f9fa', borderRadius: isMobile ? '10px' : '12px', padding: isMobile ? '12px' : '16px', marginBottom: isMobile ? '12px' : '16px' }}>
                <h4 style={{ fontWeight: '600', color: '#333', marginBottom: isMobile ? '6px' : '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: isMobile ? '14px' : '' }}>📖 元器件描述</h4>
                <p style={{ color: '#666', lineHeight: 1.8, fontSize: isMobile ? '14px' : '' }}>{result.description}</p>
              </div>
              <div style={{ display: 'flex', gap: isMobile ? '10px' : '12px', marginBottom: '8px' }}>
                <button
                  onClick={handleFavorite}
                  disabled={isFavorited}
                  style={{
                    flex: 1,
                    padding: isMobile ? '14px' : '16px',
                    background: isFavorited 
                      ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' 
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: isMobile ? '10px' : '12px',
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: 'bold',
                    cursor: isFavorited ? 'default' : 'pointer',
                    boxShadow: isFavorited ? 'none' : '0 10px 30px rgba(102, 126, 234, 0.4)',
                    transition: 'all 0.3s',
                  }}
                >
                  {isFavorited ? '⭐ 已收藏' : '⭐ 收藏'}
                </button>
                <button
                  onClick={handleLoadProjects}
                  disabled={addingToProject}
                  style={{
                    flex: 1,
                    padding: isMobile ? '14px' : '16px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: isMobile ? '10px' : '12px',
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)',
                    transition: 'all 0.3s',
                  }}
                >
                  📂 加入项目
                </button>
              </div>

              {showProjectSelect && (
                <div style={{
                  background: '#f8f9fa',
                  borderRadius: isMobile ? '10px' : '12px',
                  padding: isMobile ? '12px' : '16px',
                  marginBottom: isMobile ? '8px' : '12px',
                }}>
                  <p style={{ fontWeight: 600, color: '#333', marginBottom: '10px', fontSize: isMobile ? '13px' : '14px' }}>
                    选择目标项目
                  </p>
                  {projects.length === 0 ? (
                    <p style={{ color: '#999', fontSize: isMobile ? '12px' : '13px', marginBottom: '10px' }}>
                      暂无项目，请先去 <Link href="/projects" style={{ color: '#667eea' }}>项目页面</Link> 创建
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                      {projects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleAddToProject(p.id)}
                          disabled={addingToProject}
                          style={{
                            padding: isMobile ? '10px 14px' : '12px 16px',
                            background: addingToProject ? 'rgba(102,126,234,0.3)' : 'rgba(102,126,234,0.08)',
                            color: addingToProject ? 'rgba(255,255,255,0.5)' : '#667eea',
                            border: '1px solid rgba(102,126,234,0.2)',
                            borderRadius: '8px',
                            cursor: addingToProject ? 'not-allowed' : 'pointer',
                            fontSize: isMobile ? '13px' : '14px',
                            fontWeight: 600,
                            textAlign: 'left',
                          }}
                        >
                          📂 {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowProjectSelect(false)}
                    style={{
                      marginTop: '10px',
                      padding: '6px 14px',
                      background: 'transparent',
                      color: '#999',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    取消
                  </button>
                </div>
              )}

              {(favoriteMsg || projectMsg) && (
                <p style={{ 
                  textAlign: 'center', 
                  marginTop: '4px',
                  color: (favoriteMsg.includes('成功') || projectMsg.includes('已加入')) ? '#10b981' : '#ef4444',
                  fontSize: isMobile ? '13px' : '14px' 
                }}>
                  {favoriteMsg || projectMsg}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
