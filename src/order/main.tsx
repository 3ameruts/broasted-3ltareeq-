import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import './order.css';
import OrderApp from './OrderApp';

document.documentElement.lang = 'ar';
document.documentElement.dir = 'rtl';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OrderApp />
    <Toaster position="top-center" dir="rtl" toastOptions={{ style: { fontFamily: 'Readex Pro, Tahoma, sans-serif' } }} />
  </StrictMode>
);
