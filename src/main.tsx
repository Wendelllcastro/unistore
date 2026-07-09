import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign WebSocket/HMR errors in development/preview environment
if (typeof window !== 'undefined') {
  const preventBenignErrors = (e: ErrorEvent | PromiseRejectionEvent) => {
    const reason = e instanceof PromiseRejectionEvent ? e.reason : null;
    const message = e instanceof ErrorEvent 
      ? e.message 
      : (reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : String(reason));

    if (
      message && (
        message.toLowerCase().includes("websocket") ||
        message.toLowerCase().includes("web socket") ||
        message.toLowerCase().includes("hmr") ||
        message.includes("closed without opened") ||
        message.includes("failed to connect to websocket")
      )
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  window.addEventListener('error', preventBenignErrors, true);
  window.addEventListener('unhandledrejection', preventBenignErrors, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
