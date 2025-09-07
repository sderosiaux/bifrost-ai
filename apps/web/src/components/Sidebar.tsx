import { memo, useCallback } from 'react';
import { useStore } from '../lib/store';

export const Sidebar = memo(function Sidebar() {
  const {
    conversations,
    currentConversationId,
    selectConversation,
    createConversation,
    clearCurrentConversation,
  } = useStore();
  
  const currentConversation = conversations.find(c => c.id === currentConversationId);
  
  const handleNewChat = useCallback(() => {
    if (currentConversation && currentConversation.messages.length > 1) {
      createConversation();
    } else {
      clearCurrentConversation();
    }
  }, [currentConversation, createConversation, clearCurrentConversation]);
  
  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full">
      <div className="p-4">
        <button
          onClick={handleNewChat}
          className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto px-2">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => selectConversation(conversation.id)}
            className={`w-full text-left px-3 py-2 mb-1 rounded-lg transition-colors ${
              conversation.id === currentConversationId
                ? 'bg-gray-200 dark:bg-gray-800'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {conversation.title}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(conversation.updatedAt).toLocaleDateString()}
            </div>
          </button>
        ))}
        
        {conversations.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No conversations yet
          </div>
        )}
      </div>
    </div>
  );
});