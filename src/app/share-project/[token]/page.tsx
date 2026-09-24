'use client';

import { useParams } from 'next/navigation';
import ProjectDetailView from '@/components/ProjectDetailView';

// 分享页（学生扫码打开）：与项目详情页同一套界面，访客身份只读 + 可一键导入
export default function ShareProjectPage() {
  const params = useParams();
  return <ProjectDetailView shareToken={params.token as string} />;
}
