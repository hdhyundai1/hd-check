import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Add global error handler for debugging
window.addEventListener('error', (event) => {
  const isQuota = event.error?.message?.includes('Quota') || event.message?.includes('Quota') || String(event.error).includes('Quota');
  if (isQuota) return;
  
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
  const isQuota = event.reason?.message?.includes('Quota') || String(event.reason).includes('Quota');
  if (isQuota) return;

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

// Global smart haptic feedback for buttons, selects, and interactive controls
if (typeof window !== 'undefined') {
  let lastHapticTime = 0;
  const triggerGlobalHaptic = (pattern: number | number[]) => {
    const now = Date.now();
    // Throttle slightly to prevent stacking multiple haptics within 80ms
    if (now - lastHapticTime < 80) return;
    lastHapticTime = now;
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  };

  window.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Check if clicked element or its closest parent is an interactive element
    const btn = target.closest('button, [role="button"], a');
    if (btn) {
      const text = (btn.textContent || '').trim();
      // If button is a special confirmation/save action, it already has dedicated haptic or we give it appropriate feedback
      if (text.includes('확실한겨') || text.includes('저장')) {
        // Handled by custom handler or heavy
        return;
      }
      if (text.includes('정상출근') || text.includes('부재중') || text.includes('수정') || text.includes('캡쳐 보내기')) {
        // Moderate action handled specifically
        return;
      }
      // General buttons: tabs, search letters, close, dashboard, refresh, copy, share, etc.
      triggerGlobalHaptic(20);
      return;
    }

    const select = target.closest('select');
    if (select) {
      triggerGlobalHaptic(20);
      return;
    }
  }, { passive: true, capture: true });

  // On dropdown select change (e.g. changing company or round)
  window.addEventListener('change', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && target.tagName === 'SELECT') {
      triggerGlobalHaptic(25);
    }
  }, { passive: true, capture: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

