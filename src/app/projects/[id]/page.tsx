'use client';

import { useParams } from 'next/navigation';
import ProjectDetailView from '@/components/ProjectDetailView';

// 项目详情页：界面与分享页共用 ProjectDetailView，保证两处样式/功能一致
export default function ProjectDetailPage() {
  const params = useParams();
  return <ProjectDetailView projectId={params.id as string} />;
}
