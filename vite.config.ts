import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative base so the production build (dist/) can be opened from any folder.
  base: './',
  server: {
    port: 5173,
    open: false,
  },
});
