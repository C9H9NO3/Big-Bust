import React from 'react';
import { PurchasedItem } from '../types';
import { Download, Database, Copy, CheckCircle } from 'lucide-react';

interface PurchasedViewerProps {
  history: PurchasedItem[];
}

const PurchasedViewer: React.FC<PurchasedViewerProps> = ({ history }) => {
  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "purchased_history.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(history, null, 2));
    alert("Copied to clipboard!");
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500 bg-surface rounded-lg border border-border">
        <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p>No purchased tracking numbers yet.</p>
        <p className="text-xs mt-2 text-gray-600">Items bought via "Buy Tracking" appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Purchased History</h2>
          <p className="text-sm text-gray-400">Tracking numbers bought and saved locally.</p>
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
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-900/20 border border-green-900/40 hover:bg-green-900/30 text-green-400 rounded transition-colors"
          >
            <Download className="w-4 h-4" />
            Download JSON
          </button>
        </div>
      </div>

      <div className="bg-[#0d1117] border border-border rounded-lg p-4 font-mono text-xs overflow-auto max-h-[600px] text-gray-300 shadow-inner mb-4">
        <pre>{JSON.stringify(history, null, 2)}</pre>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {history.slice().reverse().slice(0, 9).map((item, i) => (
            <div key={i} className="bg-surface border border-border p-3 rounded flex flex-col gap-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1">
                    <CheckCircle className="w-3 h-3 text-green-500/50" />
                </div>
                <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{item.orderNumber}</span>
                    <span className="text-[10px] text-gray-500">{new Date(item.purchasedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex flex-col gap-0.5 mt-1">
                    <span className="text-xs text-primary font-mono">{item.trackingNumber}</span>
                    <a href={item.trackingUrl} target="_blank" rel="noreferrer" className="text-[10px] text-gray-500 hover:text-gray-300 underline truncate">
                        {item.trackingUrl}
                    </a>
                </div>
            </div>
        ))}
      </div>
      {history.length > 9 && (
            <div className="text-center mt-4 text-xs text-gray-500">
                ... and {history.length - 9} more items
            </div>
      )}
    </div>
  );
};

export default PurchasedViewer;
