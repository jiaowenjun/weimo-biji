import path from 'path'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'

// 本地联调：WEIMO_API_TARGET=http://localhost:8000 pnpm dev
// 本地后端路由挂在根路径，代理去掉整个 /biji/api 前缀；生产网关有 /api 前缀
const apiTarget = process.env.WEIMO_API_TARGET

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
  // weimo-ui 以 .tsx 源码形态发布（exports 指向 src），vite 不预构建它而是原样下发，
  // 因此它和 @base-ui/react 源码里引用的 CJS 包不会被自动优化，裸 CJS 进浏览器会报
  // "Importing binding name 'xxx' is not found"，必须显式 include。
  optimizeDeps: {
    include: [
      'weimo-ui > use-sync-external-store/shim',
      'weimo-ui > use-sync-external-store/shim/with-selector',
      'weimo-ui > debug',
      'weimo-ui > extend',
      'weimo-ui > style-to-js',
      'weimo-ui > katex',
      'weimo-ui > lunar-javascript',
      'weimo-ui > unified',
      'weimo-ui > remark-parse',
      'weimo-ui > remark-stringify',
      'weimo-ui > react-markdown',
      'weimo-ui > rehype-katex',
      'weimo-ui > rehype-raw',
      'weimo-ui > rehype-sanitize',
      'weimo-ui > remark-breaks',
      'weimo-ui > remark-gfm',
      'weimo-ui > remark-math',
    ],
  },
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
        path.resolve(__dirname, '../../shared/frontend/workspace-core'),
      ],
    },
    proxy: {
      '/biji/api': {
        target: apiTarget ?? 'https://weimo.ink',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/biji\/api/, apiTarget ? '' : '/api'),
      },
    },
  },
})
