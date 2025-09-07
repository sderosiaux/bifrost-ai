// Shared types between frontend and backend

export interface HarmonyMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface SamplerParams {
  temperature?: number;
  topP?: number;
  repeatPenalty?: number;
  maxTokens?: number;
}

export interface ModelStatus {
  present: boolean;
  size: number;
  checksumOk: boolean;
  progress: number;
  path?: string;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
  speed: number;
  eta: number;
}

export interface ChatStreamRequest {
  messages: HarmonyMessage[];
  params?: SamplerParams;
}

export interface ChatStreamResponse {
  token?: string;
  done?: boolean;
  error?: string;
  reason?: 'max_tokens' | 'stopped';
}

export interface ContextInfo {
  contextSize: number;
  ready: boolean;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
}