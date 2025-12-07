import React, { useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import Papa from 'papaparse';
import { ShopifyCsvRow } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: ShopifyCsvRow[]) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, disabled }) => {
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Simple validation to check if it looks like a Shopify CSV
        const rows = results.data as ShopifyCsvRow[];
        if (rows.length > 0 && 'Name' in rows[0] && 'Shipping Zip' in rows[0]) {
          onDataLoaded(rows);
        } else {
          alert("Invalid CSV format. Please ensure it's a standard Shopify export.");
        }
      },
      error: (err: Error) => { // Fixed type error here
          alert(`Error parsing CSV: ${err.message}`);
      }
    });
  }, [onDataLoaded]);

  return (
    <div className={`
      relative border-2 border-dashed border-border rounded-lg p-12 
      flex flex-col items-center justify-center text-center 
      hover:border-primary/50 transition-colors bg-surface/50
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}>
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileChange}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <div className="bg-border/30 p-4 rounded-full mb-4">
        <UploadCloud className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-medium text-white mb-1">Upload Shopify CSV</h3>
      <p className="text-sm text-gray-400">Drag and drop or click to browse</p>
    </div>
  );
};

export default FileUpload;