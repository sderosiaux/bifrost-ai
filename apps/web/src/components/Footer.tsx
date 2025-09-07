
export function Footer() {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-xs text-gray-600 dark:text-gray-400">Local</span>
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400">
        GPT-OSS 20B • Harmony Format
      </div>
    </div>
  );
}