import { useState, memo } from 'react';
import { Message as MessageType } from '../lib/store';
import ReactMarkdown from 'react-markdown';

interface MessageProps {
  message: MessageType;
}

export const Message = memo(function Message({ message }: MessageProps) {
  const [showCopy, setShowCopy] = useState(false);
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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className="max-w-3xl">
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
          onMouseEnter={() => !isUser && setShowCopy(true)}
          onMouseLeave={() => !isUser && setShowCopy(false)}
        >
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
          
          {!isUser && showCopy && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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
          )}
        </div>
      </div>
    </div>
  );
});