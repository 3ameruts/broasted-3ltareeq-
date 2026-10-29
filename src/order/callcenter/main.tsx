import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import '../order.css';
import CallCenterApp from './CallCenterApp';

document.documentElement.lang = 'ar';
document.documentElement.dir = 'rtl';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CallCenterApp />
    <Toaster position="top-center" dir="rtl" richColors toastOptions={{ style: { fontFamily: 'Readex Pro, Tahoma, sans-serif' } }} />
  </StrictMode>
);
