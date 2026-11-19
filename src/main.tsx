import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const isNativeCapacitor =
  typeof window !== 'undefined' &&
  Boolean((window as unknown as {Capacitor?: {isNativePlatform?: () => boolean}}).Capacitor?.isNativePlatform?.());

if (!isNativeCapacitor && 'serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  } else {
    registerSW({immediate: true});
  }
}

createRoot(document.getElementById('root')!).render(<App />);
