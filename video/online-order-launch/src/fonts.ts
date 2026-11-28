// Arabic Google Fonts from the official Fontsource packages, so rendering never depends on the network.
import '@fontsource/tajawal/arabic-500.css';
import '@fontsource/tajawal/arabic-800.css';
import '@fontsource/tajawal/arabic-900.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/ibm-plex-sans-arabic/latin-600.css';
import '@fontsource/lalezar/arabic-400.css';
import '@fontsource/lalezar/latin-400.css';
import '@fontsource/readex-pro/arabic-600.css';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/arabic-900.css';
import '@fontsource/cairo/latin-700.css';
import '@fontsource/cairo/latin-900.css';
import { continueRender, delayRender } from 'remotion';

const SAMPLE = 'وجبتك المفضلة 0123456789 #77';
const faces = ['400 40px Lalezar', '600 40px "Readex Pro"', '500 40px Tajawal', '800 40px Tajawal', '900 40px Tajawal', '500 40px "IBM Plex Sans Arabic"', '600 40px "IBM Plex Sans Arabic"', '700 40px Cairo', '900 40px Cairo'];
const handle = delayRender('Loading Arabic fonts');
Promise.all(faces.map(f => document.fonts.load(f, SAMPLE))).then(() => document.fonts.ready)
  .then(() => continueRender(handle)).catch(e => { console.error(e); continueRender(handle); });
