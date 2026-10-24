import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Root base: the site is served from the domain root, including the /admin page.
export default defineConfig({
  base: '/',
  plugins: [react()],
});
