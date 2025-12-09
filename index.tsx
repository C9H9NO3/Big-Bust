import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("[index.tsx] Script execution started.");

try {
  const rootElement = document.getElementById('root');
  console.log("[index.tsx] Searching for root element...", rootElement);

  if (!rootElement) {
    console.error("[index.tsx] CRITICAL: Root element #root NOT FOUND.");
    throw new Error("Could not find root element to mount to");
  }

  console.log("[index.tsx] Creating ReactDOM root...");
  const root = ReactDOM.createRoot(rootElement);
  
  console.log("[index.tsx] Rendering App component...");
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("[index.tsx] ReactDOM.render called successfully.");
} catch (error) {
  console.error("[index.tsx] FATAL ERROR during startup:", error);
  document.body.innerHTML = `<div style="color:red; padding:20px;"><h1>Startup Error</h1><pre>${error}</pre></div>`;
}
