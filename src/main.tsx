import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Request persistent local storage so browser/phone never evicts data
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((persistent) => {
    console.log(persistent ? 'Storage marked as persistent.' : 'Storage persistence not guaranteed.');
  });
}

// Register PWA Service Worker for offline operation
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('UNIT-READY ServiceWorker registered with scope: ', registration.scope);
        registration.update();
      },
      (err) => {
        console.log('UNIT-READY ServiceWorker registration failed: ', err);
      }
    );
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
