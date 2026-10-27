import './responsive.css'; //traz a responsividade para todas as paginas de forma global
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App/App';
import './index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);