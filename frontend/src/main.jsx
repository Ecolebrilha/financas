import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppDataProvider } from './context/AppDataContext';
import { ToastProvider } from './context/ToastContext';
import AuthGate from './components/AuthGate';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthGate>
          <AppDataProvider>
            <App />
          </AppDataProvider>
        </AuthGate>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
