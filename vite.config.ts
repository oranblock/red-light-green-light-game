import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['lucide-react'],
    force: true
  },
  server: {
    fs: {
      strict: true,
    },
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
  build: {
    commonjsOptions: {
      esmExternals: true,
    },
  },
});
