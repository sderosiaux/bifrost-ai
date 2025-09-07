import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelStatus {
  present: boolean;
  size: number;
  checksumOk: boolean;
  progress: number;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
  speed: number;
  eta: number;
}

interface AppState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isStreaming: boolean;
  modelStatus: ModelStatus | null;
  downloadProgress: DownloadProgress | null;
  contextSize: number;
  reasoningMode: 'low' | 'medium' | 'high';
  
  // Actions
  createConversation: () => void;
  selectConversation: (id: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateLastMessage: (content: string, reasoning?: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  setModelStatus: (status: ModelStatus) => void;
  setDownloadProgress: (progress: DownloadProgress | null) => void;
  setContextSize: (size: number) => void;
  clearCurrentConversation: () => void;
  setReasoningMode: (mode: 'low' | 'medium' | 'high') => void;
}

const DEFAULT_SYSTEM_MESSAGE = "You are a helpful AI assistant. Respond directly and concisely to user queries.";

export const useStore = create<AppState>((set) => ({
  conversations: [],
  currentConversationId: null,
  isStreaming: false,
  modelStatus: null,
  downloadProgress: null,
  contextSize: 4096,
  reasoningMode: 'low',
  
  createConversation: () => {
    const id = Date.now().toString();
    const conversation: Conversation = {
      id,
      title: 'New Chat',
      messages: [
        {
          id: Date.now().toString(),
          role: 'system',
          content: DEFAULT_SYSTEM_MESSAGE,
          timestamp: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    set((state) => ({
      conversations: [...state.conversations, conversation],
      currentConversationId: id,
    }));
  },
  
  selectConversation: (id: string) => {
    set({ currentConversationId: id });
  },
  
  addMessage: (message) => {
    const id = Date.now().toString();
    const newMessage: Message = {
      ...message,
      id,
      timestamp: new Date(),
    };
    
    set((state) => {
      const conversations = state.conversations.map((conv) => {
        if (conv.id === state.currentConversationId) {
          const updatedConv = {
            ...conv,
            messages: [...conv.messages, newMessage],
            updatedAt: new Date(),
          };
          
          // Update title based on first user message
          if (conv.title === 'New Chat' && message.role === 'user' && conv.messages.length <= 2) {
            updatedConv.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
          }
          
          return updatedConv;
        }
        return conv;
      });
      
      return { conversations };
    });
  },
  
  updateLastMessage: (content: string, reasoning?: string) => {
    set((state) => {
      const conversations = state.conversations.map((conv) => {
        if (conv.id === state.currentConversationId) {
          const messages = [...conv.messages];
          if (messages.length > 0) {
            messages[messages.length - 1] = {
              ...messages[messages.length - 1],
              content,
              reasoning,
            };
          }
          return { ...conv, messages };
        }
        return conv;
      });
      
      return { conversations };
    });
  },
  
  setStreaming: (isStreaming: boolean) => {
    set({ isStreaming });
  },
  
  setModelStatus: (modelStatus: ModelStatus) => {
    set({ modelStatus });
  },
  
  setDownloadProgress: (downloadProgress: DownloadProgress | null) => {
    set({ downloadProgress });
  },
  
  setContextSize: (contextSize: number) => {
    set({ contextSize });
  },
  
  clearCurrentConversation: () => {
    set((state) => {
      const conversations = state.conversations.map((conv) => {
        if (conv.id === state.currentConversationId) {
          return {
            ...conv,
            messages: [
              {
                id: Date.now().toString(),
                role: 'system' as const,
                content: DEFAULT_SYSTEM_MESSAGE,
                timestamp: new Date(),
              },
            ],
            title: 'New Chat',
            updatedAt: new Date(),
          };
        }
        return conv;
      });
      
      return { conversations };
    });
  },
  
  setReasoningMode: (reasoningMode: 'low' | 'medium' | 'high') => {
    set({ reasoningMode });
  },
}));