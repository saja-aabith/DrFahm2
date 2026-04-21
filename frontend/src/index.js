import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n'; // must be imported before App so translations are ready
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);