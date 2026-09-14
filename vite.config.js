import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/tg-bot-designer/',
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
});