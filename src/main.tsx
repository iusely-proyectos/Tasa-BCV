// Fix for "Cannot set property fetch of #<Window> which has only a getter" error in sandboxed iframes
try {
  let customFetch = window.fetch || (typeof globalThis !== 'undefined' ? globalThis.fetch : null);
  if (customFetch) {
    const descriptor = {
      get() {
        return customFetch;
      },
      set(val) {
        customFetch = val;
      },
      configurable: true,
      enumerable: true
    };

    const targets = [];
    if (typeof window !== 'undefined') targets.push(window);
    if (typeof globalThis !== 'undefined') targets.push(globalThis);
    if (typeof self !== 'undefined') targets.push(self);
    if (typeof Window !== 'undefined' && Window.prototype) targets.push(Window.prototype);

    for (const target of targets) {
      try {
        Object.defineProperty(target, 'fetch', descriptor);
      } catch (err) {
        console.warn('Failed to patch fetch on target:', err);
      }
    }
  }
} catch (e) {
  console.warn('Failed to set up fetch proxy in main.tsx:', e);
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
