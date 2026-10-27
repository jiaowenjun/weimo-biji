import path from 'path'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  base: '/biji/',
  build: {
    manifest: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: [
      'react',
      'react-dom',
      '@base-ui/react',
      'lucide-react',
      'react-router',
    ],
  },
  server: {
    port: 5175,
    strictPort: true,
    fs: {
      allow: [
        path.resolve(__dirname, '..'),
        path.resolve(__dirname, '../../../shared/frontend/workspace-core'),
      ],
    },
    proxy: {
      '/biji/api': {
        target: 'https://weimo.ink',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/biji\/api/, '/api'),
      },
    },
  },
})
