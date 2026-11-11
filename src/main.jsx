import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import './index.css';

// Bloqueia arrastar e soltar (drag & drop) de imagens e elementos em todo o aplicativo
window.addEventListener('dragstart', (e) => e.preventDefault(), { capture: true });
window.addEventListener('drop', (e) => e.preventDefault(), { capture: true });
window.addEventListener('dragover', (e) => e.preventDefault(), { capture: true });

// Bloqueia menu de contexto do navegador em imagens para impedir download/cópia indevida
window.addEventListener('contextmenu', (e) => {
  const tag = e.target?.tagName?.toLowerCase();
  // Permite menu de contexto apenas em campos de digitação (para colar/copiar texto)
  if (tag !== 'input' && tag !== 'textarea') {
    e.preventDefault();
  }
}, { capture: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
