import { Message, ModelStatus, DownloadProgress } from './store';
import { withRetry } from './retry';

const API_BASE = '';

export interface ChatParams {
  temperature?: number;
  topP?: number;
  repeatPenalty?: number;
  maxTokens?: number;
  reasoningMode?: 'low' | 'medium' | 'high';
}

export async function checkHealth(): Promise<boolean> {
  try {
    return await withRetry(async () => {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();
      return data.status === 'ok';
    }, { maxAttempts: 3 });
  } catch {
    return false;
  }
}

export async function getModelStatus(): Promise<ModelStatus> {
  return withRetry(async () => {
    const response = await fetch(`${API_BASE}/model/status`);
    if (!response.ok) throw new Error('Failed to get model status');
    return response.json();
  });
}

export async function startModelDownload(): Promise<void> {
  const response = await fetch(`${API_BASE}/model/download`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to start download');
}

export async function cancelModelDownload(): Promise<void> {
  const response = await fetch(`${API_BASE}/model/cancel`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to cancel download');
}

export function subscribeToDownloadProgress(
  onProgress: (progress: DownloadProgress) => void,
  onError?: (error: Error) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/model/progress`);
  
  eventSource.onmessage = (event) => {
    try {
      const progress = JSON.parse(event.data);
      onProgress(progress);
    } catch (error) {
      console.error('Failed to parse progress:', error);
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('Download progress error:', error);
    if (onError) onError(new Error('Download progress connection failed'));
  };
  
  return () => {
    eventSource.close();
  };
}

export async function getContextInfo(): Promise<{ contextSize: number; ready: boolean }> {
  const response = await fetch(`${API_BASE}/chat/context`);
  if (!response.ok) throw new Error('Failed to get context info');
  return response.json();
}

export async function* streamChat(
  messages: Message[],
  params?: ChatParams,
  signal?: AbortSignal
): AsyncGenerator<{ token?: string; done?: boolean; error?: string; reason?: string; phase?: string }> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({ role, content })),
      params,
    }),
    signal,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start chat');
  }
  
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');
  
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          console.log('[Frontend] Received SSE data:', data);
          yield data;
          if (data.done) return;
        } catch (error) {
          console.error('Failed to parse SSE data:', error, 'Line:', line);
        }
      }
    }
  }
}

export async function stopChat(): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/stop`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to stop chat');
}