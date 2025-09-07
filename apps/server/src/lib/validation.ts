import { HarmonyMessage } from './harmony.js';

const MAX_MESSAGE_LENGTH = 10000;
const MAX_MESSAGES = 100;
const MAX_TOKENS = 4096;
const MIN_TOKENS = 1;

export function sanitizeInput(input: string): string {
  // Remove control characters except newlines and tabs
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, MAX_MESSAGE_LENGTH);
}

export function validateMessages(messages: unknown): HarmonyMessage[] {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array');
  }
  
  if (messages.length > MAX_MESSAGES) {
    throw new Error(`Too many messages. Maximum is ${MAX_MESSAGES}`);
  }
  
  const validatedMessages: HarmonyMessage[] = [];
  
  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      throw new Error('Invalid message format');
    }
    
    const { role, content } = message as any;
    
    if (!['system', 'user', 'assistant', 'tool'].includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }
    
    if (typeof content !== 'string') {
      throw new Error('Message content must be a string');
    }
    
    validatedMessages.push({
      role,
      content: sanitizeInput(content),
    });
  }
  
  return validatedMessages;
}

export function validateSamplerParams(params: unknown): any {
  if (!params || typeof params !== 'object') {
    return {};
  }
  
  const p = params as any;
  const validated: any = {};
  
  if (typeof p.temperature === 'number') {
    validated.temperature = Math.max(0, Math.min(2, p.temperature));
  }
  
  if (typeof p.topP === 'number') {
    validated.topP = Math.max(0, Math.min(1, p.topP));
  }
  
  if (typeof p.repeatPenalty === 'number') {
    validated.repeatPenalty = Math.max(0.1, Math.min(2, p.repeatPenalty));
  }
  
  if (typeof p.maxTokens === 'number') {
    validated.maxTokens = Math.max(MIN_TOKENS, Math.min(MAX_TOKENS, Math.floor(p.maxTokens)));
  }
  
  return validated;
}