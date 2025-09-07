import { useState, memo } from 'react';
import { Message as MessageType, useStore } from '../lib/store';
import ReactMarkdown from 'react-markdown';

interface MessageProps {
  message: MessageType;
  onBranch?: (messageId: string) => void;
  isLatestAssistant?: boolean;
}

export const Message = memo(function Message({ message, onBranch, isLatestAssistant }: MessageProps) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const hasReasoning = message.reasoning && message.reasoning.length > 0;
  
  if (isSystem) return null;
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 group`}>
      <div className="max-w-3xl relative">
        {/* Reasoning toggle (only for assistant messages with reasoning) */}
        {!isUser && hasReasoning && (
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="mb-2 px-3 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
          >
            <svg 
              className={`w-3 h-3 transition-transform ${showReasoning ? 'rotate-90' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>Show reasoning</span>
          </button>
        )}
        
        {/* Reasoning content (collapsible) */}
        {!isUser && showReasoning && hasReasoning && (
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Model reasoning</span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap">
              {message.reasoning}
            </div>
          </div>
        )}
        
        {/* Main message content */}
        <div
          className={`relative px-4 py-3 rounded-lg ${
            isUser
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          }`}
          onMouseEnter={() => !isUser && setShowActions(true)}
          onMouseLeave={() => !isUser && setShowActions(false)}
        >
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
          
          {!isUser && showActions && (
            <div className="absolute top-2 right-2 flex gap-1">
              {/* Fork button */}
              {onBranch && !isLatestAssistant && (
                <button
                  onClick={() => {
                    // Find the user message that preceded this assistant message
                    const state = useStore.getState();
                    const conversation = state.conversations.find(c => c.id === state.currentConversationId);
                    
                    if (conversation) {
                      const allMessages = conversation.messages;
                      const messageIndex = allMessages.findIndex(m => m.id === message.id);
                      
                      console.log('Fork button clicked for assistant message:', message.id, 'at index:', messageIndex);
                      console.log('Total messages:', allMessages.length);
                      console.log('Messages:', allMessages.map(m => ({ id: m.id, role: m.role })));
                      
                      // Find the preceding user message (skip system messages)
                      let foundUserMessage = false;
                      for (let i = messageIndex - 1; i >= 0; i--) {
                        console.log(`Checking message at index ${i}: role=${allMessages[i].role}`);
                        if (allMessages[i].role === 'user') {
                          console.log('Found preceding user message:', allMessages[i].id, 'at index:', i);
                          onBranch(allMessages[i].id);
                          foundUserMessage = true;
                          break;
                        }
                      }
                      
                      if (!foundUserMessage) {
                        console.error('No user message found before assistant message');
                        // If this is the first assistant response after system message, 
                        // we can't create a branch (no user message to branch from)
                      }
                    }
                  }}
                  className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                  title="Create branch from here"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </button>
              )}
              
              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                title="Copy message"
              >
                {copied ? (
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});