import React from 'react';
import { TrackingResult } from '../types';
import { FileJson, Copy } from 'lucide-react';

interface DetailedLogViewerProps {
  results: TrackingResult[];
}

const DetailedLogViewer: React.FC<DetailedLogViewerProps> = ({ results }) => {
  const copyLog = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert('Log copied to clipboard');
  };

  if (results.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500 bg-surface rounded-lg border border-border">
        <FileJson className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p>No logs available. Process some orders to see detailed JSON.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
             <h2 className="text-lg font-semibold text-white">Detailed Execution Logs</h2>
             <span className="text-xs text-gray-500">Showing last {results.length} processed items</span>
        </div>
      {results.map((res, i) => (
        <div key={i} className="bg-[#0d1117] border border-border rounded-lg overflow-hidden">
          <div className="bg-surface border-b border-border px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-primary font-mono font-bold">#{res.orderNumber}</span>
              <span className="text-xs text-gray-400">Zip: {res.zip}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  res.status === 'PROCESSED' ? 'border-green-900/50 text-green-400 bg-green-900/10' :
                  res.status === 'SKIPPED' ? 'border-gray-700 text-gray-400 bg-gray-800' :
                  res.status === 'QUEUED' ? 'border-blue-900/50 text-blue-400 bg-blue-900/10' :
                  'border-red-900/50 text-red-400 bg-red-900/10'
              }`}>
                  {res.status}
              </span>
            </div>
            <button 
                onClick={() => copyLog(res)}
                className="text-gray-500 hover:text-white transition-colors p-1"
                title="Copy JSON"
            >
                <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4 font-mono text-[10px] text-gray-300 overflow-x-auto">
            <pre className="whitespace-pre-wrap break-all">
{JSON.stringify({
    order: {
        number: res.orderNumber,
        zip: res.zip,
        date: res.orderDate,
    },
    result: {
        status: res.status,
        note: res.note,
        tracking: res.trackingNumber
    },
    debug: res.debugInfo
}, null, 2)}
            </pre>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DetailedLogViewer;