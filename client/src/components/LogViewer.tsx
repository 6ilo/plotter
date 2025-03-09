import { usePlotter } from "@/hooks/usePlotter";

export default function LogViewer() {
  const { logEntries, clearLog } = usePlotter();

  // Log entry color classes based on type
  const getLogEntryClass = (type: string) => {
    switch (type) {
      case 'sent':
        return 'text-yellow-300';
      case 'received':
        return 'text-cyan-400';
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-300';
      default:
        return 'text-gray-400';
    }
  };

  // Log entry prefix based on type
  const getLogEntryPrefix = (type: string) => {
    switch (type) {
      case 'sent':
        return '[SENT] ';
      case 'received':
        return '[RECV] ';
      case 'error':
        return '[ERROR] ';
      case 'warning':
        return '[WARN] ';
      default:
        return '[INFO] ';
    }
  };

  return (
    <div className="bg-gray-900 p-4 border border-white">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl uppercase font-bold">Communication Log</h2>
        <button 
          className="bg-white text-black px-3 py-1 text-sm uppercase hover:bg-opacity-80"
          onClick={clearLog}
        >
          Clear
        </button>
      </div>
      <div className="h-48 overflow-y-auto bg-black p-2 border border-white font-mono text-xs">
        {logEntries.map((entry, index) => (
          <div key={index} className="log-entry">
            <span className={getLogEntryClass(entry.type)}>
              {getLogEntryPrefix(entry.type)}
            </span>
            {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
}
