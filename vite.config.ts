import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative base so the production build (dist/) can be opened from any folder.
  base: './',
  server: {
    // Data (IndexedDB) belongs to http://localhost:5173: never start on another port,
    // otherwise the app would open empty. If 5173 is busy, Vite stops with an error instead.
    port: 5173,
    strictPort: true,
    open: false,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
});
