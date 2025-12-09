import React, { useState, useEffect } from 'react';
import { LayoutDashboard, List, Activity, Terminal, PlayCircle, Settings, FileJson, ShoppingCart, Loader2, Send, History, Trash2, Check, AlertOctagon } from 'lucide-react';
import FileUpload from './components/FileUpload';
import ConsoleTable from './components/ConsoleTable';
import QueueViewer from './components/QueueViewer';
import DetailedLogViewer from './components/DetailedLogViewer';
import PurchasedViewer from './components/PurchasedViewer';
import FailedViewer from './components/FailedViewer';
import SettingsModal, { AppSettings } from './components/SettingsModal';
import { getTrackingForOrder, buyTrackingNumber, fulfillShopifyOrder } from './services/trackingService';
import { QueueItem, ShopifyCsvRow, TrackingResult, PurchasedItem, FailedItem } from './types';

console.log("[App.tsx] Module loaded.");

const App: React.FC = () => {
  console.log("[App.tsx] Component rendering...");

  try {
      // Application State
      const [activeTab, setActiveTab] = useState<'console' | 'queue' | 'logs' | 'purchased' | 'failed'>('console');
      const [isProcessing, setIsProcessing] = useState(false);
      const [isBuying, setIsBuying] = useState(false);
      const [isFulfilling, setIsFulfilling] = useState(false);
      const [progress, setProgress] = useState(0);
      const [logs, setLogs] = useState<string[]>([]);
      const [showSettings, setShowSettings] = useState(false);
      
      // Persisted Config
      const [daysForQueue, setDaysForQueue] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('trackmaster_days_queue');
            return saved ? Number(saved) : 4;
        } catch (e) { return 4; }
      });
      const [daysForWarning, setDaysForWarning] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('trackmaster_days_warning');
            return saved ? Number(saved) : 7;
        } catch (e) { return 7; }
      });

      const [apiLimit, setApiLimit] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('trackmaster_api_limit');
            return saved ? Number(saved) : 3000;
        } catch (e) { return 3000; }
      });

      const [settings, setSettings] = useState<AppSettings>(() => {
          try {
            const saved = localStorage.getItem('trackmaster_settings');
            const parsed = saved ? JSON.parse(saved) : {
                apiKey: "",
                shopifyDomain: "",
                shopifyToken: "",
                corsProxyApiKey: ""
            };
            console.log("[App.tsx] Settings loaded from local storage.");
            return parsed;
          } catch (e) {
              console.warn("[App.tsx] Failed to load settings, using default.", e);
              return { apiKey: "", shopifyDomain: "", shopifyToken: "", corsProxyApiKey: "" };
          }
      });
      
      // Data State
      const [processedResults, setProcessedResults] = useState<TrackingResult[]>([]);
      const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
      
      const [queue, setQueue] = useState<QueueItem[]>(() => {
        try {
            const saved = localStorage.getItem('trackmaster_queue');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
      });

      const [purchasedHistory, setPurchasedHistory] = useState<PurchasedItem[]>(() => {
        try {
            const saved = localStorage.getItem('trackmaster_purchased');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
      });

      const [failedItems, setFailedItems] = useState<FailedItem[]>(() => {
        try {
            const saved = localStorage.getItem('trackmaster_failed');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
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
          localStorage.setItem('trackmaster_failed', JSON.stringify(failedItems));
      }, [failedItems]);

      useEffect(() => {
        localStorage.setItem('trackmaster_api_limit', String(apiLimit));
      }, [apiLimit]);

      useEffect(() => {
        localStorage.setItem('trackmaster_days_queue', String(daysForQueue));
      }, [daysForQueue]);

      useEffect(() => {
        localStorage.setItem('trackmaster_days_warning', String(daysForWarning));
      }, [daysForWarning]);

      useEffect(() => {
        localStorage.setItem('trackmaster_settings', JSON.stringify(settings));
      }, [settings]);

      // Debugging Mount
      useEffect(() => {
          console.log("[App.tsx] App Component Mounted via useEffect.");
      }, []);

      const addLog = (msg: string) => {
        console.log(`[Log] ${msg}`);
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 99)]);
      };

      const addFailedItem = (orderNumber: string, action: FailedItem['action'], reason: string) => {
          console.error(`[Failed Item] ${orderNumber} (${action}): ${reason}`);
          setFailedItems(prev => [{
              orderNumber,
              action,
              reason,
              timestamp: new Date().toISOString()
          }, ...prev]);
      };

      const handleSaveSettings = (newSettings: AppSettings) => {
          console.log("[App.tsx] Saving settings...");
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
          console.log("[App.tsx] handleBuyTracking started");
          if (selectedOrders.size === 0) return;
          
          const ordersToBuy = Array.from(selectedOrders) as string[];

          if (!settings.apiKey) {
              alert("Please configure API Key in settings first.");
              setShowSettings(true);
              return;
          }

          setIsBuying(true);
          setProgress(0);
          addLog(`Initiating purchase for ${selectedOrders.size} orders...`);

          const updatedResults = [...processedResults];
          let successCount = 0;
          let failCount = 0;
          const newPurchases: PurchasedItem[] = [];

          for (let i = 0; i < ordersToBuy.length; i++) {
              const orderNum = ordersToBuy[i];
              const idx = updatedResults.findIndex(r => r.orderNumber === orderNum);
              
              if (idx === -1) continue;
              const item = updatedResults[idx];

              if (!item.hashId) {
                  addLog(`Order ${orderNum}: No Hash ID available. Skipping.`);
                  addFailedItem(orderNum, 'BUY', 'No Hash ID available');
                  failCount++;
                  continue;
              }
              if (item.trackingNumber && !item.trackingNumber.includes('*')) {
                  addLog(`Order ${orderNum}: Already has full tracking number. Skipping.`);
                  continue;
              }

              try {
                  const fullTracking = await buyTrackingNumber(item.hashId, settings.apiKey, settings.corsProxyApiKey);
                  
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
                  const errMsg = (err as Error).message;
                  addLog(`Order ${orderNum} Failed: ${errMsg}`);
                  addFailedItem(orderNum, 'BUY', errMsg);
                  failCount++;
              }

              setProgress(Math.round(((i + 1) / ordersToBuy.length) * 100));
              setProcessedResults([...updatedResults]);
              await new Promise(r => setTimeout(r, 200));
          }

          setPurchasedHistory(prev => [...prev, ...newPurchases]);
          setIsBuying(false);
          addLog(`Purchase complete. Success: ${successCount}, Failed: ${failCount}`);
      };

      const handleFulfillOrders = async () => {
        console.log("[App.tsx] handleFulfillOrders started");
        if (selectedOrders.size === 0) return;
        
        const ordersToFulfill = Array.from(selectedOrders) as string[];

        if (!settings.shopifyDomain || !settings.shopifyToken) {
            alert("Please configure Shopify credentials in settings first.");
            setShowSettings(true);
            return;
        }

        setIsFulfilling(true);
        setProgress(0);
        addLog(`Initiating Fulfillment for ${selectedOrders.size} orders...`);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < ordersToFulfill.length; i++) {
            const orderNum = ordersToFulfill[i];
            const item = processedResults.find(r => r.orderNumber === orderNum);
            
            if (!item) continue;

            if (!item.shopifyOrderId) {
                addLog(`Order ${orderNum}: Missing Shopify ID in CSV. Skipping.`);
                addFailedItem(orderNum, 'FULFILL', 'Missing Shopify ID in CSV');
                failCount++;
                continue;
            }

            if (!item.trackingNumber || item.trackingNumber.includes('*')) {
                addLog(`Order ${orderNum}: Invalid tracking number (still encrypted/missing). Buy it first.`);
                addFailedItem(orderNum, 'FULFILL', 'Invalid tracking number');
                failCount++;
                continue;
            }

            try {
                await fulfillShopifyOrder(
                    item.shopifyOrderId, 
                    item.trackingNumber,
                    settings.shopifyDomain,
                    settings.shopifyToken,
                    settings.corsProxyApiKey
                );
                addLog(`Order ${orderNum}: Fulfilled on Shopify!`);
                successCount++;
            } catch (err) {
                const errMsg = (err as Error).message;
                addLog(`Order ${orderNum} Fulfillment Failed: ${errMsg}`);
                addFailedItem(orderNum, 'FULFILL', errMsg);
                failCount++;
            }
            
            setProgress(Math.round(((i + 1) / ordersToFulfill.length) * 100));
            await new Promise(r => setTimeout(r, 500));
        }

        setIsFulfilling(false);
        addLog(`Fulfillment complete. Success: ${successCount}, Failed: ${failCount}`);
      };

      const handleDataLoaded = async (rawRows: ShopifyCsvRow[]) => {
        console.log("[App.tsx] CSV Data Loaded:", rawRows.length, "rows");
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
            const result = await getTrackingForOrder(row, apiLimit, settings.apiKey, daysForQueue, daysForWarning, settings.corsProxyApiKey);
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
                if (res.status === 'ERROR') {
                    addLog(`Order ${res.orderNumber} -> Error: ${res.note}`);
                    addFailedItem(res.orderNumber, 'PROCESS', res.note || 'Unknown Error');
                }
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

      const getProgressBarColor = () => {
          if (isBuying) return 'bg-yellow-500';
          if (isFulfilling) return 'bg-blue-500';
          return 'bg-primary';
      };

      const getProgressLabel = () => {
          if (isBuying) return 'Buying Tracking...';
          if (isFulfilling) return 'Fulfilling Orders...';
          return 'Processing Orders...';
      };

      console.log("[App.tsx] Returning JSX...");

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
            
            {/* Unified Status Bar */}
            {(isProcessing || isBuying || isFulfilling) && (
              <div className="mb-8 p-4 bg-surface border border-border rounded-lg relative overflow-hidden">
                <div className={`absolute top-0 left-0 h-1 transition-all duration-300 ${getProgressBarColor()}`} style={{ width: `${progress}%` }}></div>
                <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                      <PlayCircle className={`w-5 h-5 animate-pulse ${isBuying ? 'text-yellow-500' : isFulfilling ? 'text-blue-500' : 'text-primary'}`} />
                      <span className="text-white font-medium">{getProgressLabel()}</span>
                    </div>
                    <span className={`font-mono ${isBuying ? 'text-yellow-500' : isFulfilling ? 'text-blue-500' : 'text-primary'}`}>{progress}%</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                
                {/* Sidebar / Controls */}
                <div className="lg:col-span-1 space-y-6">
                    <FileUpload onDataLoaded={handleDataLoaded} disabled={isProcessing || isBuying || isFulfilling} />
                    
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

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Min Days (Queue)</label>
                                <input 
                                    type="number" 
                                    value={daysForQueue}
                                    onChange={(e) => setDaysForQueue(Number(e.target.value))}
                                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none transition-colors font-mono"
                                    disabled={isProcessing}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Warning Days</label>
                                <input 
                                    type="number" 
                                    value={daysForWarning}
                                    onChange={(e) => setDaysForWarning(Number(e.target.value))}
                                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none transition-colors font-mono"
                                    disabled={isProcessing}
                                />
                            </div>
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
                        <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border w-fit overflow-x-auto max-w-full">
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
                            <button 
                                onClick={() => setActiveTab('failed')}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap
                                    ${activeTab === 'failed' ? 'bg-background text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}
                                `}
                            >
                                <AlertOctagon className="w-4 h-4" />
                                Failed
                                {failedItems.length > 0 && (
                                    <span className="bg-red-900/40 text-red-400 text-[10px] px-1.5 rounded-full">{failedItems.length}</span>
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
                                    disabled={selectedOrders.size === 0 || isBuying || isFulfilling || isProcessing}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
                                        ${selectedOrders.size > 0 && !isBuying && !isFulfilling && !isProcessing
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
                                    disabled={selectedOrders.size === 0 || isBuying || isFulfilling || isProcessing}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
                                        ${selectedOrders.size > 0 && !isBuying && !isFulfilling && !isProcessing
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
                        ) : activeTab === 'failed' ? (
                            <FailedViewer items={failedItems} />
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
  } catch (renderError) {
      console.error("[App.tsx] FATAL Render Error:", renderError);
      return (
          <div className="min-h-screen bg-black text-red-500 flex flex-col items-center justify-center p-8">
              <h1 className="text-3xl font-bold mb-4">Application Crashed</h1>
              <div className="bg-gray-900 p-4 rounded border border-gray-800 max-w-2xl overflow-auto">
                <pre>{(renderError as Error).message}</pre>
                <pre className="text-xs text-gray-500 mt-2">{(renderError as Error).stack}</pre>
              </div>
          </div>
      );
  }
};

export default App;
