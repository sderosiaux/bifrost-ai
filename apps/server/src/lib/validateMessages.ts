import { HarmonyMessage } from './harmony.js';

export class MessageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessageValidationError';
  }
}

export function validateMessageStructure(messages: HarmonyMessage[]): void {
  if (!Array.isArray(messages)) {
    throw new MessageValidationError('Messages must be an array');
  }
  
  if (messages.length === 0) {
    throw new MessageValidationError('Messages array cannot be empty');
  }
  
  const validRoles = new Set(['system', 'user', 'assistant', 'tool']);
  let lastRole: string | null = null;
  let hasSystemMessage = false;
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    if (!message || typeof message !== 'object') {
      throw new MessageValidationError(`Message at index ${i} is not an object`);
    }
    
    if (!message.role || !validRoles.has(message.role)) {
      throw new MessageValidationError(
        `Message at index ${i} has invalid role: ${message.role}. Valid roles are: ${Array.from(validRoles).join(', ')}`
      );
    }
    
    if (typeof message.content !== 'string') {
      throw new MessageValidationError(`Message at index ${i} has invalid content: must be a string`);
    }
    
    if (message.content.length === 0) {
      throw new MessageValidationError(`Message at index ${i} has empty content`);
    }
    
    // System message rules
    if (message.role === 'system') {
      if (i !== 0) {
        throw new MessageValidationError('System message must be the first message if present');
      }
      hasSystemMessage = true;
    }
    
    // Check for consecutive same roles (except system at start)
    if (lastRole === message.role && message.role !== 'system') {
      throw new MessageValidationError(
        `Consecutive ${message.role} messages at index ${i}. Messages should alternate between roles.`
      );
    }
    
    // Tool messages must follow assistant messages with function calls
    if (message.role === 'tool' && lastRole !== 'assistant') {
      throw new MessageValidationError(
        `Tool message at index ${i} must follow an assistant message with function calls`
      );
    }
    
    lastRole = message.role;
  }
  
  // Last message should typically be from user (for generation)
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== 'user' && lastMessage.role !== 'tool') {
    console.warn('Last message is not from user or tool - this may not generate a response');
  }
}