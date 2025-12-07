
import React from 'react';
import { FailedItem } from '../types';
import { AlertOctagon, Trash2, Copy } from 'lucide-react';

interface FailedViewerProps {
  failedItems: FailedItem[];
  onClear: () => void;
}

const FailedViewer: React.FC<FailedViewerProps> = ({ failedItems, onClear }) => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(failedItems, null, 2));
    alert("Copied logs to clipboard!");
  };

  if (failedItems.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500 bg-surface rounded-lg border border-border">
        <AlertOctagon className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p>No failed operations recorded.</p>
        <p className="text-xs mt-2 text-gray-600">Failures during processing, buying, or fulfillment will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white text-red-400">Failed Operations</h2>
          <p className="text-sm text-gray-400">Errors encountered during various stages.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-surface border border-border hover:bg-border text-gray-300 rounded transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy Logs
          </button>
          <button 
            onClick={onClear}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-900/20 border border-red-900/40 hover:bg-red-900/30 text-red-400 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-border rounded-lg bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/40 text-gray-400 font-mono text-xs uppercase border-b border-border">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Order #</th>
              <th className="px-4 py-3 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {failedItems.slice().reverse().map((item, idx) => (
              <tr key={idx} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                   {new Date(item.failedAt).toLocaleTimeString()}
                </td>
                <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${
                        item.stage === 'PROCESSING' ? 'border-yellow-900/50 bg-yellow-900/10 text-yellow-500' :
                        item.stage === 'BUYING' ? 'border-orange-900/50 bg-orange-900/10 text-orange-500' :
                        'border-red-900/50 bg-red-900/10 text-red-500'
                    }`}>
                        {item.stage}
                    </span>
                </td>
                <td className="px-4 py-3 font-mono text-white">{item.orderNumber}</td>
                <td className="px-4 py-3 text-red-300 text-xs font-mono">{item.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FailedViewer;
