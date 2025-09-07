export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  shouldRetry: (error) => {
    // Retry on network errors or 5xx status codes
    if (error.name === 'NetworkError' || error.name === 'TypeError') {
      return true;
    }
    if (error.status && error.status >= 500) {
      return true;
    }
    return false;
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelay;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === opts.maxAttempts || !opts.shouldRetry(error)) {
        throw error;
      }
      
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff with jitter
      delay = Math.min(
        opts.maxDelay,
        delay * opts.backoffFactor + Math.random() * 1000
      );
    }
  }
  
  throw lastError;
}

export class RetryableEventSource {
  private eventSource: EventSource | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<(event: MessageEvent) => void>> = new Map();
  private errorListeners: Set<(error: Event) => void> = new Set();
  
  constructor(url: string) {
    this.url = url;
    this.connect();
  }
  
  private connect() {
    this.eventSource = new EventSource(this.url);
    
    this.eventSource.onopen = () => {
      console.log('SSE connection established');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    };
    
    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      
      for (const listener of this.errorListeners) {
        listener(error);
      }
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Reconnecting SSE in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})...`);
        
        setTimeout(() => {
          this.close();
          this.connect();
        }, this.reconnectDelay);
        
        this.reconnectDelay = Math.min(10000, this.reconnectDelay * 2);
      }
    };
    
    this.eventSource.onmessage = (event) => {
      const listeners = this.listeners.get('message') || new Set();
      for (const listener of listeners) {
        listener(event);
      }
    };
  }
  
  on(event: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    
    if (this.eventSource && event !== 'message') {
      this.eventSource.addEventListener(event, listener as any);
    }
  }
  
  onError(listener: (error: Event) => void) {
    this.errorListeners.add(listener);
  }
  
  close() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}