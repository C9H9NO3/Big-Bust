import React from 'react';
import { TrackingResult } from '../types';
import { ExternalLink, CheckCircle, AlertTriangle, XCircle, Package } from 'lucide-react';

interface ConsoleTableProps {
  data: TrackingResult[];
  selectedOrders: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
}

const ConsoleTable: React.FC<ConsoleTableProps> = ({ data, selectedOrders, onToggleSelect, onToggleAll }) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500 bg-surface rounded-lg border border-border">
        <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p>No processed data yet. Upload a CSV to begin.</p>
      </div>
    );
  }

  const allSelected = data.length > 0 && data.every(r => selectedOrders.has(r.orderNumber));
  const someSelected = data.some(r => selectedOrders.has(r.orderNumber));

  return (
    <div className="overflow-x-auto border border-border rounded-lg bg-surface shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-black/40 text-gray-400 font-mono text-xs uppercase border-b border-border">
          <tr>
            <th className="px-4 py-3 w-10 text-center">
              <input 
                type="checkbox"
                checked={allSelected}
                ref={input => {
                    if (input) input.indeterminate = someSelected && !allSelected;
                }}
                onChange={onToggleAll}
                className="w-4 h-4 rounded border-gray-600 text-primary focus:ring-primary bg-transparent cursor-pointer"
              />
            </th>
            <th className="px-4 py-3 font-medium">Order #</th>
            <th className="px-4 py-3 font-medium">Zip</th>
            <th className="px-4 py-3 font-medium">Order Date</th>
            <th className="px-4 py-3 font-medium">Tracking</th>
            <th className="px-4 py-3 font-medium">Expected</th>
            <th className="px-4 py-3 font-medium">Weight</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row, idx) => {
            const isSelected = selectedOrders.has(row.orderNumber);
            return (
                <tr 
                    key={`${row.orderNumber}-${idx}`} 
                    className={`transition-colors ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-white/5'}`}
                >
                  <td className="px-4 py-3 text-center">
                    <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => onToggleSelect(row.orderNumber)}
                        className="w-4 h-4 rounded border-gray-600 text-primary focus:ring-primary bg-transparent cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-white font-medium">{row.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-300">{row.zip}</td>
                  <td className="px-4 py-3 text-gray-400">{row.orderDate}</td>
                  <td className="px-4 py-3">
                    {row.trackingUrl ? (
                      <a 
                        href={row.trackingUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center text-primary hover:text-primaryHover hover:underline font-mono whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.trackingNumber}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                     {row.expectedDelivery ? (
                        <div className="flex items-center gap-2">
                            <span className="text-gray-200">{row.expectedDelivery}</span>
                        </div>
                     ) : (
                        <span className="text-gray-600">-</span>
                     )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{row.weight || '-'}</td>
                  <td className="px-4 py-3">
                    {row.status === 'PROCESSED' && (
                        <div className="flex flex-col">
                             <span className="inline-flex items-center text-xs text-green-400">
                                 <CheckCircle className="w-3 h-3 mr-1" /> OK
                             </span>
                             {row.note && <span className="text-[10px] text-yellow-500">{row.note}</span>}
                        </div>
                    )}
                    
                    {row.status === 'SKIPPED' && (
                        <div className="flex flex-col">
                            <span className="inline-flex items-center text-xs text-gray-500">
                                <XCircle className="w-3 h-3 mr-1" /> Skipped
                            </span>
                            <span className="text-[10px] text-gray-600">{row.note}</span>
                        </div>
                    )}
                    
                    {row.status === 'ERROR' && (
                        <div className="flex flex-col">
                            <span className="inline-flex items-center text-xs text-red-400">
                                <AlertTriangle className="w-3 h-3 mr-1" /> Error
                            </span>
                            <span className="text-[10px] text-red-900/70 truncate max-w-[150px]">{row.note}</span>
                        </div>
                    )}
                  </td>
                </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ConsoleTable;