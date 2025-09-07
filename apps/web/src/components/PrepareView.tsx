import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { startModelDownload, cancelModelDownload, subscribeToDownloadProgress } from '../lib/api';

export function PrepareView() {
  const { downloadProgress, setDownloadProgress } = useStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!isDownloading) return;
    
    const unsubscribe = subscribeToDownloadProgress(
      (progress) => {
        setDownloadProgress(progress);
      },
      (error) => {
        setError(error.message);
        setIsDownloading(false);
      }
    );
    
    return unsubscribe;
  }, [isDownloading, setDownloadProgress]);
  
  const handleStart = async () => {
    try {
      setError(null);
      setIsDownloading(true);
      await startModelDownload();
    } catch (err: any) {
      setError(err.message);
      setIsDownloading(false);
    }
  };
  
  const handleCancel = async () => {
    try {
      await cancelModelDownload();
      setIsDownloading(false);
      setDownloadProgress(null);
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };
  
  const formatSpeed = (bytesPerSecond: number) => {
    const mbps = bytesPerSecond / (1024 * 1024);
    return `${mbps.toFixed(1)} MB/s`;
  };
  
  const formatEta = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };
  
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Prepare Model
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            The GPT-OSS 20B model needs to be downloaded before you can start chatting.
          </p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
        
        {!isDownloading && !downloadProgress && (
          <button
            onClick={handleStart}
            className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
          >
            Download Model
          </button>
        )}
        
        {(isDownloading || downloadProgress) && (
          <div className="space-y-4">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Progress</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {downloadProgress?.percentage.toFixed(1)}%
                </span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress?.percentage || 0}%` }}
                />
              </div>
              
              {downloadProgress && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Downloaded</span>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {formatBytes(downloadProgress.downloaded)} / {formatBytes(downloadProgress.total)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Speed</span>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {formatSpeed(downloadProgress.speed)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">ETA</span>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {formatEta(downloadProgress.eta)}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={handleCancel}
              className="w-full px-6 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg transition-colors font-medium"
            >
              Cancel Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}