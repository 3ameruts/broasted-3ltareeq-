import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import content from './src/data/default-content.json';
import { buildSchema, buildFallbackHtml } from './src/lib/seo';
import type { Content } from './src/lib/types';

// Writes the restaurant schema and a plain-text copy of the page into index.html,
// so search engines read the menu without running the app.
function seo(): Plugin {
  return {
    name: 'broasted-seo',
    transformIndexHtml(html) {
      const c = content as unknown as Content;
      return html
        .replace('<!--SCHEMA-->', JSON.stringify(buildSchema(c)).replace(/</g, '\\u003c'))
        .replace('<!--FALLBACK-->', buildFallbackHtml(c));
    },
  };
}

// Root base: the site is served from the domain root, including the /admin page.
export default defineConfig({
  base: '/',
  plugins: [react(), seo()],
});
