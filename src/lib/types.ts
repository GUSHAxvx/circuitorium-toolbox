// 前后端共用的数据类型定义

export interface User {
  id: number;
  username: string;
}

export interface RecognitionResult {
  name: string;
  type: string;
  description: string;
  confidence: number;
  imagePath: string;
  // AI 增强字段（OpenAI 识别时返回）
  model?: string;
  manufacturer?: string;
  packageType?: string;
  pinCount?: number;
  specifications?: string;
}

export interface HistoryItem {
  id: number;
  image_path: string;
  component_name: string;
  component_type: string;
  description: string;
  confidence: number;
  created_at: string;
}

export interface Favorite {
  id: number;
  image_path: string;
  component_name: string;
  component_type: string;
  description: string;
  confidence: number;
  notes: string | null;
  created_at: string;
}
