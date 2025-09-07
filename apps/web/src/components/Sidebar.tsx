import { memo, useCallback, useState } from 'react';
import { useStore } from '../lib/store';

export const Sidebar = memo(function Sidebar() {
  const {
    conversations,
    currentConversationId,
    selectConversation,
    createConversation,
    clearCurrentConversation,
    switchBranch,
  } = useStore();
  
  const [expandedConversations, setExpandedConversations] = useState<Set<string>>(new Set());
  const currentConversation = conversations.find(c => c.id === currentConversationId);
  
  const handleNewChat = useCallback(() => {
    if (currentConversation && currentConversation.messages.length > 1) {
      createConversation();
    } else {
      clearCurrentConversation();
    }
  }, [currentConversation, createConversation, clearCurrentConversation]);
  
  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full flex-shrink-0">
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
        {conversations.map((conversation) => {
          const hasBranches = conversation.branches && conversation.branches.length > 0;
          const isExpanded = expandedConversations.has(conversation.id);
          const isCurrentConv = conversation.id === currentConversationId;
          
          return (
            <div key={conversation.id} className="mb-1">
              <div className="flex items-center">
                <button
                  onClick={() => {
                    selectConversation(conversation.id);
                    if (conversation.currentBranchId) {
                      switchBranch('main');
                    }
                  }}
                  className={`flex-1 text-left px-3 py-2 rounded-lg transition-colors ${
                    isCurrentConv && !conversation.currentBranchId
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
                {hasBranches && (
                  <button
                    onClick={() => {
                      setExpandedConversations(prev => {
                        const next = new Set(prev);
                        if (next.has(conversation.id)) {
                          next.delete(conversation.id);
                        } else {
                          next.add(conversation.id);
                        }
                        return next;
                      });
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  >
                    <svg 
                      className={`w-4 h-4 text-gray-500 transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
              
              {hasBranches && isExpanded && (
                <div className="ml-4 mt-1 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                  {conversation.branches?.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => {
                        selectConversation(conversation.id);
                        switchBranch(branch.id);
                      }}
                      className={`w-full text-left px-2 py-1 mb-1 rounded transition-colors text-xs ${
                        isCurrentConv && conversation.currentBranchId === branch.id
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <span className="truncate">{branch.title}</span>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 ml-4">
                        {branch.messages.length} messages
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        
        {conversations.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No conversations yet
          </div>
        )}
      </div>
    </div>
  );
});