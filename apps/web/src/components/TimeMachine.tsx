import { useState } from 'react';
import { Message } from '../lib/store';

interface TimeMachineProps {
  messages: Message[];
  onBranch: (messageId: string) => void;
  currentBranchId?: string;
  branches?: Array<{ id: string; title: string; messageCount: number }>;
  onSwitchBranch?: (branchId: string) => void;
}

export function TimeMachine({ messages, onBranch, currentBranchId, branches = [], onSwitchBranch }: TimeMachineProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const handleRewind = (messageId: string) => {
    setSelectedMessageId(messageId);
    onBranch(messageId);
    setIsOpen(false);
  };

  return (
    <>
      {/* Time Machine Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-6 p-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 z-50"
        title="Time Machine"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {branches.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {branches.length}
          </span>
        )}
      </button>

      {/* Time Machine Panel */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Time Machine
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex h-[60vh]">
              {/* Timeline */}
              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4">CONVERSATION TIMELINE</h3>
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-600 to-blue-600"></div>
                  {messages.filter(m => m.role !== 'system').map((message, index) => (
                    <div
                      key={message.id}
                      className={`relative pl-12 pb-6 ${selectedMessageId === message.id ? 'opacity-50' : ''}`}
                    >
                      <div className={`absolute left-2 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${
                        message.role === 'user' ? 'bg-purple-600' : 'bg-blue-600'
                      } ${message.branchPoint ? 'ring-4 ring-yellow-400' : ''}`}></div>
                      
                      <div className="group">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-xs text-gray-500 mb-1">
                              {message.role === 'user' ? 'You' : 'Assistant'} • {new Date(message.timestamp).toLocaleTimeString()}
                            </div>
                            <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                              {message.content}
                            </div>
                          </div>
                          
                          {message.role === 'user' && index < messages.length - 2 && (
                            <button
                              onClick={() => handleRewind(message.id)}
                              className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50"
                              title="Branch from here"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Branches */}
              <div className="w-64 border-l border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900/50">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4">BRANCHES</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => onSwitchBranch?.('main')}
                    className={`w-full p-3 rounded-lg transition-all text-left ${
                      !currentBranchId 
                        ? 'bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 border-2 border-purple-400' 
                        : 'bg-white dark:bg-gray-800 hover:shadow-md'
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Main Timeline
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Original conversation
                    </div>
                  </button>
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => onSwitchBranch?.(branch.id)}
                      className={`w-full p-3 rounded-lg transition-all text-left ${
                        currentBranchId === branch.id 
                          ? 'bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 border-2 border-purple-400' 
                          : 'bg-white dark:bg-gray-800 hover:shadow-md'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {branch.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {branch.messageCount} messages
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}