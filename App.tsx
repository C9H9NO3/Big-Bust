
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, List, Activity, Terminal, PlayCircle, Settings, FileJson, ShoppingCart, Loader2, Send, History, Trash2, Check } from 'lucide-react';
import FileUpload from './components/FileUpload';
import ConsoleTable from './components/ConsoleTable';
import QueueViewer from './components/QueueViewer';
import DetailedLogViewer from './components/DetailedLogViewer';
import PurchasedViewer from './components/PurchasedViewer';
import SettingsModal, { AppSettings } from './components/SettingsModal';
import { getTrackingForOrder, buyTrackingNumber, fulfillShopifyOrder } from './services/trackingService';
import { QueueItem, ShopifyCsvRow, TrackingResult, PurchasedItem } from './types';

const App: React.FC = () => {
  // Application State
  const [activeTab, setActiveTab] = useState<'console' | 'queue' | 'logs' | 'purchased'>('console');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
  // Persisted Config
  const [apiLimit, setApiLimit] = useState<number>(() => {
    const saved = localStorage.getItem('trackmaster_api_limit');
    return saved ? Number(saved) : 3000;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
      const saved = localStorage.getItem('trackmaster_settings');
      return saved ? JSON.parse(saved) : {
          apiKey: "",
          shopifyDomain: "",
          shopifyToken: ""
      };
  });
  
  // Data State
  const [processedResults, setProcessedResults] = useState<TrackingResult[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    const saved = localStorage.getItem('trackmaster_queue');
    return saved ? JSON.parse(saved) : [];
  });

  const [purchasedHistory, setPurchasedHistory] = useState<PurchasedItem[]>(() => {
    const saved = localStorage.getItem('trackmaster_purchased');
    return saved ? JSON.parse(saved) : [];
  });

  // Derived state for the console view
  const consoleData = processedResults.filter(r => r.status !== 'QUEUED');

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('trackmaster_queue', JSON.stringify(queue));
  }, [queue]);

  useEffect(() => {
    localStorage.setItem('trackmaster_purchased', JSON.stringify(purchasedHistory));
  }, [purchasedHistory]);

  useEffect(() => {
    localStorage.setItem('trackmaster_api_limit', String(apiLimit));
  }, [apiLimit]);

  useEffect(() => {
    localStorage.setItem('trackmaster_settings', JSON.stringify(settings));
  }, [settings]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 99)]);
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
      setSettings(newSettings);
      setShowSettings(false);
      addLog("Settings updated successfully.");
  };

  const handleToggleSelect = (orderNumber: string) => {
    const newSet = new Set(selectedOrders);
    if (newSet.has(orderNumber)) {
        newSet.delete(orderNumber);
    } else {
        newSet.add(orderNumber);
    }
    setSelectedOrders(newSet);
  };

  const handleToggleAll = () => {
    const allSelected = consoleData.length > 0 && consoleData.every(r => selectedOrders.has(r.orderNumber));
    const newSet = new Set(selectedOrders);
    
    if (allSelected) {
        consoleData.forEach(r => newSet.delete(r.orderNumber));
    } else {
        consoleData.forEach(r => newSet.add(r.orderNumber));
    }
    setSelectedOrders(newSet);
  };

  const handleClearConsole = () => {
      if (confirm("Are you sure you want to clear the current results?")) {
          setProcessedResults([]);
          setSelectedOrders(new Set());
          addLog("Console results cleared.");
      }
  };

  const handleBuyTracking = async () => {
      if (selectedOrders.size === 0) return;
      
      const ordersToBuy = Array.from(selectedOrders) as string[];

      if (!settings.apiKey) {
          alert("Please configure API Key in settings first.");
          setShowSettings(true);
          return;
      }

      setIsBuying(true);
      addLog(`Initiating purchase for ${selectedOrders.size} orders...`);

      const updatedResults = [...processedResults];
      let successCount = 0;
      let failCount = 0;
      const newPurchases: PurchasedItem[] = [];

      for (const orderNum of ordersToBuy) {
          const idx = updatedResults.findIndex(r => r.orderNumber === orderNum);
          if (idx === -1) continue;

          const item = updatedResults[idx];

          if (!item.hashId) {
              addLog(`Order ${orderNum}: No Hash ID available. Skipping.`);
              failCount++;
              continue;
          }
          if (item.trackingNumber && !item.trackingNumber.includes('*')) {
              addLog(`Order ${orderNum}: Already has full tracking number. Skipping.`);
              continue;
          }

          try {
              const fullTracking = await buyTrackingNumber(item.hashId, settings.apiKey);
              
              const trackingUrl = `https://www.ups.com/track?tracknum=${fullTracking}`;
              
              // Update Result in State
              updatedResults[idx] = {
                  ...item,
                  trackingNumber: fullTracking,
                  trackingUrl: trackingUrl,
                  status: 'PROCESSED',
                  note: 'Purchased Successfully'
              };

              // Add to history
              newPurchases.push({
                  orderNumber: orderNum,
                  trackingNumber: fullTracking,
                  trackingUrl: trackingUrl,
                  expectedDelivery: item.expectedDelivery,
                  zip: item.zip,
                  purchasedAt: new Date().toISOString()
              });
              
              addLog(`Order ${orderNum}: Purchased! ${fullTracking}`);
              successCount++;
          } catch (err) {
              addLog(`Order ${orderNum} Failed: ${(err as Error).message}`);
              failCount++;
          }

          setProcessedResults([...updatedResults]);
          await new Promise(r => setTimeout(r, 200));
      }

      setPurchasedHistory(prev => [...prev, ...newPurchases]);
      setIsBuying(false);
      addLog(`Purchase complete. Success: ${successCount}, Failed: ${failCount}`);
  };

  const handleFulfillOrders = async () => {
    if (selectedOrders.size === 0) return;
    
    const ordersToFulfill = Array.from(selectedOrders) as string[];

    if (!settings.shopifyDomain || !settings.shopifyToken) {
        alert("Please configure Shopify credentials in settings first.");
        setShowSettings(true);
        return;
    }

    setIsFulfilling(true);
    addLog(`Initiating Fulfillment for ${selectedOrders.size} orders...`);

    let successCount = 0;
    let failCount = 0;

    for (const orderNum of ordersToFulfill) {
        const item = processedResults.find(r => r.orderNumber === orderNum);
        
        if (!item) continue;

        if (!item.shopifyOrderId) {
            addLog(`Order ${orderNum}: Missing Shopify ID in CSV. Skipping.`);
            failCount++;
            continue;
        }

        if (!item.trackingNumber || item.trackingNumber.includes('*')) {
            addLog(`Order ${orderNum}: Invalid tracking number (still encrypted/missing). Buy it first.`);
            failCount++;
            continue;
        }

        try {
            await fulfillShopifyOrder(
                item.shopifyOrderId, 
                item.trackingNumber,
                settings.shopifyDomain,
                settings.shopifyToken
            );
            addLog(`Order ${orderNum}: Fulfilled on Shopify!`);
            successCount++;
        } catch (err) {
            addLog(`Order ${orderNum} Fulfillment Failed: ${(err as Error).message}`);
            failCount++;
        }

        await new Promise(r => setTimeout(r, 500));
    }

    setIsFulfilling(false);
    addLog(`Fulfillment complete. Success: ${successCount}, Failed: ${failCount}`);
  };

  const handleDataLoaded = async (rawRows: ShopifyCsvRow[]) => {
    if (isProcessing) return;
    
    if (!settings.apiKey) {
        alert("Please configure API Key in settings first.");
        setShowSettings(true);
        return;
    }

    // --- 1. PRE-PROCESS & DEDUPLICATE ---
    const uniqueOrders = new Map<string, ShopifyCsvRow>();

    rawRows.forEach(row => {
      const orderNum = row['Name'];
      if (!orderNum) return;
      if (!uniqueOrders.has(orderNum)) {
        uniqueOrders.set(orderNum, row);
      } else {
        const existingRow = uniqueOrders.get(orderNum)!;
        const existingZip = existingRow['Shipping Zip']?.trim();
        const currentZip = row['Shipping Zip']?.trim();
        if (!existingZip && currentZip) {
          uniqueOrders.set(orderNum, row);
        }
      }
    });

    const rowsToProcess = Array.from(uniqueOrders.values());

    // --- 2. START PROCESSING ---
    setIsProcessing(true);
    setProcessedResults([]); 
    setSelectedOrders(new Set());
    setProgress(0);
    addLog(`Found ${rowsToProcess.length} unique orders from ${rawRows.length} CSV rows.`);
    
    let completed = 0;
    const newQueueItems: QueueItem[] = [];
    
    const CHUNK_SIZE = 5;
    
    for (let i = 0; i < rowsToProcess.length; i += CHUNK_SIZE) {
      const chunk = rowsToProcess.slice(i, i + CHUNK_SIZE);
      
      const promises = chunk.map(async (row) => {
         const orderNum = row['Name'];
         
         // CHECK PURCHASED HISTORY FIRST
         const savedItem = purchasedHistory.find(p => p.orderNumber === orderNum);
         if (savedItem) {
             // Return synthetic result from local history
             const result: TrackingResult = {
                 orderNumber: orderNum,
                 shopifyOrderId: row['Id'],
                 zip: savedItem.zip,
                 orderDate: row['Created at'].substring(0, 10),
                 trackingNumber: savedItem.trackingNumber,
                 trackingUrl: savedItem.trackingUrl,
                 expectedDelivery: savedItem.expectedDelivery,
                 status: 'PROCESSED',
                 note: 'Loaded from Purchased History',
                 is7DaysFuture: true, // Assuming bought ones were good
                 processedAt: new Date().toISOString(),
                 debugInfo: { source: 'local_storage' }
             };
             return result;
         }

         // If not in history, call API
         const result = await getTrackingForOrder(row, apiLimit, settings.apiKey);
         return result;
      });

      const chunkResults = await Promise.all(promises);

      for (const res of chunkResults) {
        if (res.status === 'QUEUED' && res.trackingUrl && res.expectedDelivery) {
            newQueueItems.push({
                orderNumber: res.orderNumber,
                trackingUrl: res.trackingUrl,
                expectedDelivery: res.expectedDelivery,
                addedAt: new Date().toISOString()
            });
            addLog(`Order ${res.orderNumber} -> Queued (${res.note})`);
        } else if (res.status === 'PROCESSED') {
             if (res.debugInfo?.source === 'local_storage') {
                 addLog(`Order ${res.orderNumber} -> Loaded from History`);
             } else if (!res.is7DaysFuture) {
                addLog(`Order ${res.orderNumber} -> Processed (Warning: ${res.note})`);
            } else {
                addLog(`Order ${res.orderNumber} -> Processed successfully`);
            }
        } else {
            if (res.status === 'ERROR') addLog(`Order ${res.orderNumber} -> Error: ${res.note}`);
            if (res.status === 'SKIPPED') addLog(`Order ${res.orderNumber} -> Skipped: ${res.note}`);
        }
      }

      completed += chunk.length;
      setProgress(Math.round((completed / rowsToProcess.length) * 100));
      setProcessedResults(prev => [...prev, ...chunkResults]);
      await new Promise(r => setTimeout(r, 100));
    }

    setQueue(prev => [...prev, ...newQueueItems]);
    setIsProcessing(false);
    addLog(`Finished processing.`);
  };

  return (
    <div className="min-h-screen bg-background text-gray-300 font-sans selection:bg-primary/20 selection:text-primary">
      {/* Header */}
      <header className="border-b border-border bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-emerald-900 flex items-center justify-center text-white font-bold">
              TM
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">TrackMaster <span className="text-primary font-mono text-sm">PRO</span></h1>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium">
             <div className="flex items-center gap-2 text-gray-500">
                <Activity className="w-4 h-4" />
                <span>API Status: Ready</span>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Processing Status Bar */}
        {isProcessing && (
          <div className="mb-8 p-4 bg-surface border border-primary/30 rounded-lg relative overflow-hidden">
             <div className="absolute top-0 left-0 h-1 bg-primary transition-all duration-300" style={{ width: `${progress}%` }}></div>
             <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-3">
                   <PlayCircle className="w-5 h-5 text-primary animate-pulse" />
                   <span className="text-white font-medium">Processing Orders...</span>
                </div>
                <span className="font-mono text-primary">{progress}%</span>
             </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Sidebar / Controls */}
            <div className="lg:col-span-1 space-y-6">
                <FileUpload onDataLoaded={handleDataLoaded} disabled={isProcessing} />
                
                {/* Configuration Input */}
                <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-2 text-gray-400 border-b border-border pb-2">
                        <Settings className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Configuration</span>
                    </div>
                    
                    <div>
                        <div className="flex justify-between items-center mb-1">
                             <label className="block text-xs text-gray-500">Max API Results per Zip</label>
                             <span className="text-[10px] text-green-500 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Saved
                             </span>
                        </div>
                        <input 
                            type="number" 
                            value={apiLimit}
                            onChange={(e) => setApiLimit(Number(e.target.value))}
                            className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none transition-colors font-mono placeholder-gray-600"
                            disabled={isProcessing}
                            placeholder="Default: 3000"
                        />
                    </div>

                    <button 
                        onClick={() => setShowSettings(true)}
                        className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 py-2 rounded text-xs font-medium transition-colors border border-border"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        Manage Keys & Tokens
                    </button>
                </div>

                {/* Mini Log Console */}
                <div className="bg-surface border border-border rounded-lg p-4 h-[400px] flex flex-col">
                    <div className="flex items-center gap-2 mb-3 text-gray-400 border-b border-border pb-2">
                        <Terminal className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">System Log</span>
                    </div>
                    <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1 pr-1 custom-scrollbar">
                        {logs.length === 0 && <span className="text-gray-600 italic">Waiting for input...</span>}
                        {logs.map((log, i) => (
                            <div key={i} className="text-gray-400 border-l-2 border-transparent hover:border-primary pl-2 transition-colors">
                                {log}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3 flex flex-col gap-6">
                
                {/* Tabs & Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border w-fit overflow-x-auto">
                        <button 
                            onClick={() => setActiveTab('console')}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap
                                ${activeTab === 'console' ? 'bg-background text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}
                            `}
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            Results
                            {consoleData.length > 0 && (
                                <span className="bg-gray-800 text-gray-300 text-[10px] px-1.5 rounded-full">{consoleData.length}</span>
                            )}
                        </button>
                        <button 
                            onClick={() => setActiveTab('queue')}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap
                                ${activeTab === 'queue' ? 'bg-background text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}
                            `}
                        >
                            <List className="w-4 h-4" />
                            Queued
                            {queue.length > 0 && (
                                <span className="bg-primary/20 text-primary text-[10px] px-1.5 rounded-full">{queue.length}</span>
                            )}
                        </button>
                        <button 
                            onClick={() => setActiveTab('logs')}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap
                                ${activeTab === 'logs' ? 'bg-background text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}
                            `}
                        >
                            <FileJson className="w-4 h-4" />
                            Logs
                        </button>
                        <button 
                            onClick={() => setActiveTab('purchased')}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap
                                ${activeTab === 'purchased' ? 'bg-background text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}
                            `}
                        >
                            <History className="w-4 h-4" />
                            Purchased
                            {purchasedHistory.length > 0 && (
                                <span className="bg-green-900/40 text-green-400 text-[10px] px-1.5 rounded-full">{purchasedHistory.length}</span>
                            )}
                        </button>
                    </div>

                    {/* Action Buttons */}
                    {activeTab === 'console' && (
                        <div className="flex gap-2">
                            <button 
                                onClick={handleClearConsole}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-red-900/10 text-red-400 border border-red-900/20 hover:bg-red-900/30 hover:border-red-900/50"
                                title="Clear Console"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            <button 
                                onClick={handleBuyTracking}
                                disabled={selectedOrders.size === 0 || isBuying || isFulfilling}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
                                    ${selectedOrders.size > 0 && !isBuying && !isFulfilling
                                        ? 'bg-primary text-white border-primary hover:bg-primaryHover cursor-pointer shadow-lg shadow-primary/20' 
                                        : 'bg-transparent text-gray-600 border-border cursor-not-allowed'}
                                `}
                            >
                                {isBuying ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Buying...
                                    </>
                                ) : (
                                    <>
                                        <ShoppingCart className="w-4 h-4" />
                                        Buy Tracking
                                        {selectedOrders.size > 0 && (
                                            <span className="bg-white/20 text-white text-[10px] px-1.5 rounded-full ml-1">
                                                {selectedOrders.size}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>

                            <button 
                                onClick={handleFulfillOrders}
                                disabled={selectedOrders.size === 0 || isBuying || isFulfilling}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
                                    ${selectedOrders.size > 0 && !isBuying && !isFulfilling
                                        ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-500 cursor-pointer shadow-lg shadow-blue-600/20' 
                                        : 'bg-transparent text-gray-600 border-border cursor-not-allowed'}
                                `}
                            >
                                {isFulfilling ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Fulfilling...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Fulfill
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Tab Content */}
                <div className="animate-in fade-in duration-300">
                    {activeTab === 'console' ? (
                        <ConsoleTable 
                            data={consoleData} 
                            selectedOrders={selectedOrders}
                            onToggleSelect={handleToggleSelect}
                            onToggleAll={handleToggleAll}
                        />
                    ) : activeTab === 'queue' ? (
                        <QueueViewer queue={queue} />
                    ) : activeTab === 'purchased' ? (
                        <PurchasedViewer history={purchasedHistory} />
                    ) : (
                        <DetailedLogViewer results={processedResults} />
                    )}
                </div>
            </div>
        </div>
      </main>

      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        onSave={handleSaveSettings}
        initialSettings={settings}
      />
    </div>
  );
};

export default App;
