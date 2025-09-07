import { useEffect } from 'react';
import { useStore } from './lib/store';
import { getModelStatus, getContextInfo } from './lib/api';
import { Sidebar } from './components/Sidebar';
import { Chat } from './components/Chat';
import { Footer } from './components/Footer';
import { PrepareView } from './components/PrepareView';

function App() {
  const {
    conversations,
    modelStatus,
    setModelStatus,
    setContextSize,
    createConversation,
  } = useStore();
  
  useEffect(() => {
    // Check model status on mount
    const checkModel = async () => {
      try {
        const status = await getModelStatus();
        setModelStatus(status);
        
        if (status.present) {
          const contextInfo = await getContextInfo();
          setContextSize(contextInfo.contextSize);
        }
      } catch (error) {
        console.error('Failed to check model status:', error);
      }
    };
    
    checkModel();
    const interval = setInterval(checkModel, 5000);
    
    return () => clearInterval(interval);
  }, [setModelStatus, setContextSize]);
  
  useEffect(() => {
    // Create initial conversation if none exists
    if (conversations.length === 0) {
      createConversation();
    }
  }, [conversations.length, createConversation]);
  
  const showPrepareView = !modelStatus?.present;
  
  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex-shrink-0 px-4 py-3 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              GPT-OSS Chat
            </h1>
            <div className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
              Local
            </div>
          </div>
        </header>
        
        {showPrepareView ? (
          <PrepareView />
        ) : (
          <Chat />
        )}
        
        <Footer />
      </div>
    </div>
  );
}

export default App;