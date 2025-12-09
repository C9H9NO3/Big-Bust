import React from 'react';
import { FailedItem } from '../types';
import { AlertOctagon, Copy } from 'lucide-react';

interface FailedViewerProps {
  items: FailedItem[];
}

const FailedViewer: React.FC<FailedViewerProps> = ({ items }) => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(items, null, 2));
    alert("Copied to clipboard!");
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500 bg-surface rounded-lg border border-border">
        <AlertOctagon className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p>No failed items recorded.</p>
        <p className="text-xs mt-2 text-gray-600">Errors during buying or processing appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Failed Operations</h2>
          <p className="text-sm text-gray-400">Log of errors encountered during execution.</p>
        </div>
        <div>
           <button 
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-surface border border-border hover:bg-border text-gray-300 rounded transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy Log
          </button>
        </div>
      </div>

      <div className="bg-[#0d1117] border border-border rounded-lg overflow-hidden flex-1 shadow-inner flex flex-col">
        <div className="overflow-y-auto custom-scrollbar flex-1">
            <table className="w-full text-left text-xs font-mono">
                <thead className="bg-surface/50 text-gray-400 border-b border-border sticky top-0 backdrop-blur-sm z-10">
                    <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Order #</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Reason</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border text-gray-300">
                    {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                {new Date(item.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="px-4 py-3 font-bold text-white">
                                {item.orderNumber}
                            </td>
                            <td className="px-4 py-3">
                                <span className={`px-1.5 py-0.5 rounded border text-[10px] uppercase font-bold ${
                                    item.action === 'BUY' ? 'border-yellow-900/50 bg-yellow-900/10 text-yellow-500' :
                                    item.action === 'FULFILL' ? 'border-blue-900/50 bg-blue-900/10 text-blue-500' :
                                    'border-red-900/50 bg-red-900/10 text-red-500'
                                }`}>
                                    {item.action}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-red-400/80 break-all">
                                {item.reason}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default FailedViewer;