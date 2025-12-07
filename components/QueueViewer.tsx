import React from 'react';
import { QueueItem } from '../types';
import { Download, Database, Copy } from 'lucide-react';

interface QueueViewerProps {
  queue: QueueItem[];
}

const QueueViewer: React.FC<QueueViewerProps> = ({ queue }) => {
  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(queue, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "queued.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(queue, null, 2));
    alert("Copied to clipboard!");
  };

  if (queue.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500 bg-surface rounded-lg border border-border">
        <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p>No orders currently in the holding queue.</p>
        <p className="text-xs mt-2 text-gray-600">Orders placed &lt; 4 days ago appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Queued Orders</h2>
          <p className="text-sm text-gray-400">Orders held because they were created recently (&lt; 4 days).</p>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-surface border border-border hover:bg-border text-gray-300 rounded transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
          <button 
            onClick={downloadJson}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary rounded transition-colors"
          >
            <Download className="w-4 h-4" />
            Download JSON
          </button>
        </div>
      </div>

      <div className="bg-[#0d1117] border border-border rounded-lg p-4 font-mono text-xs overflow-auto max-h-[600px] text-gray-300 shadow-inner">
        <pre>{JSON.stringify(queue, null, 2)}</pre>
      </div>
      
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {queue.slice(0, 6).map((item, i) => (
            <div key={i} className="bg-surface border border-border p-3 rounded flex flex-col gap-1">
                <span className="font-bold text-white">{item.orderNumber}</span>
                <span className="text-xs text-gray-500 truncate">{item.trackingUrl}</span>
                <span className="text-xs text-primary">{item.expectedDelivery}</span>
            </div>
        ))}
        {queue.length > 6 && (
            <div className="flex items-center justify-center text-xs text-gray-500">
                + {queue.length - 6} more items
            </div>
        )}
      </div>
    </div>
  );
};

export default QueueViewer;