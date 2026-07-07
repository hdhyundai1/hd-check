import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Add global error handler for debugging
window.addEventListener('error', (event) => {
  console.error("Global Error Caught:", event.error);
  const errDiv = document.createElement('div');
  errDiv.style.position = 'fixed';
  errDiv.style.top = '0';
  errDiv.style.left = '0';
  errDiv.style.zIndex = '9999';
  errDiv.style.background = 'red';
  errDiv.style.color = 'white';
  errDiv.style.padding = '10px';
  errDiv.innerText = 'Error: ' + (event.error?.message || event.message);
  document.body.appendChild(errDiv);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error("Unhandled Promise Rejection:", event.reason);
  const errDiv = document.createElement('div');
  errDiv.style.position = 'fixed';
  errDiv.style.bottom = '0';
  errDiv.style.left = '0';
  errDiv.style.zIndex = '9999';
  errDiv.style.background = 'orange';
  errDiv.style.color = 'white';
  errDiv.style.padding = '10px';
  errDiv.innerText = 'Promise Rejection: ' + (event.reason?.message || event.reason);
  document.body.appendChild(errDiv);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
