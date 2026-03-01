import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {

  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: command === 'build' ? '/static/do_again_list/' : '/',
    build: {
      outDir: '../do_again_list/static/do_again_list',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/index.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
    server: {
      proxy: {
        '/do_again/api': {
          target: env.VITE_SERVER_PROXY_TARGET_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
