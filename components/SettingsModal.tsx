import React, { useState, useEffect } from 'react';
import { X, Save, Lock, Globe, Server, Eye, EyeOff } from 'lucide-react';

console.log("[SettingsModal.tsx] Module loaded.");

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  initialSettings: AppSettings;
}

export interface AppSettings {
  apiKey: string;
  shopifyDomain: string;
  shopifyToken: string;
  corsProxyApiKey?: string;
}

const SecretInput = ({ 
  value, 
  onChange, 
  placeholder,
  className 
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}) => {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input 
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors focus:outline-none"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, initialSettings }) => {
  const [formData, setFormData] = useState<AppSettings>(initialSettings);

  useEffect(() => {
    setFormData(initialSettings);
  }, [initialSettings, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-white/5">
          <h2 className="text-lg font-semibold text-white">Application Settings</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          
          {/* API Key */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <Lock className="w-3 h-3" /> Gettnship API Key
            </label>
            <SecretInput 
              value={formData.apiKey}
              onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Enter your API key..."
              className="w-full bg-[#09090b] border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder-gray-600"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <Server className="w-3 h-3" /> CORS Proxy Key (Optional)
            </label>
            <SecretInput 
              value={formData.corsProxyApiKey || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, corsProxyApiKey: e.target.value }))}
              placeholder="e.g. 0cfaf0e9"
              className="w-full bg-[#09090b] border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder-gray-600"
            />
            <p className="text-[9px] text-gray-500">Leave empty to use free proxy (slower/limited).</p>
          </div>

          <div className="border-t border-gray-800 my-4"></div>

          {/* Shopify Config */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-2">
                <Globe className="w-3 h-3" /> Shopify Store Domain
              </label>
              <input 
                type="text" 
                value={formData.shopifyDomain}
                onChange={(e) => setFormData(prev => ({ ...prev, shopifyDomain: e.target.value }))}
                placeholder="example.myshopify.com"
                className="w-full bg-[#09090b] border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder-gray-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-2">
                <Lock className="w-3 h-3" /> Shopify Access Token
              </label>
              <SecretInput 
                value={formData.shopifyToken}
                onChange={(e) => setFormData(prev => ({ ...prev, shopifyToken: e.target.value }))}
                placeholder="shpat_..."
                className="w-full bg-[#09090b] border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder-gray-600"
              />
            </div>
          </div>

          <p className="text-[10px] text-gray-500 bg-blue-900/10 border border-blue-900/30 p-3 rounded text-center">
            Credentials are stored securely in your browser's local storage.
          </p>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-white/5 flex justify-end">
          <button 
            onClick={() => onSave(formData)}
            className="flex items-center gap-2 bg-primary hover:bg-primaryHover text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-primary/20"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
