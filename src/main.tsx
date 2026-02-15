import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

declare const __BUILD_TIMESTAMP__: string;
console.log(`[EAC] Build: ${__BUILD_TIMESTAMP__}`);

// Service Worker registration and update handling
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = import.meta.env.MODE === 'production'
      ? '/competition/sw.js'
      : '/sw.js';

    navigator.serviceWorker.register(swUrl)
      .then((registration) => {
        console.log('[SW] Registered successfully');

        // Check for updates every 60 seconds
        setInterval(() => {
          registration.update();
        }, 60000);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker installed, prompt user to refresh
              console.log('[SW] New version available! Reloading...');
              // Auto-reload after 2 seconds
              setTimeout(() => {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }, 2000);
            }
          });
        });
      })
      .catch((error) => {
        console.error('[SW] Registration failed:', error);
      });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        console.log('[SW] Service worker updated, reloading page...');
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
