import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Client-only SPA: index.html ships an empty root (no SSR markup to hydrate).
createRoot(document.getElementById('root')!).render(<App />);
