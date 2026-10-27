import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    // 仓库内存在历史遗留的同名 .ts/.js 时，测试应优先以 .ts 作为源码事实源。
    extensions: ['.ts', '.mts', '.js', '.mjs', '.json'],
    // 与小程序一致：运行时以 miniprogram/package.json 为准；Vitest 从根目录解析时指向该处
    alias: {
      'pinyin-pro': path.join(root, 'miniprogram/node_modules/pinyin-pro'),
      'lunar-javascript': path.join(root, 'miniprogram/node_modules/lunar-javascript'),
    },
  },
  test: {
    include: ['miniprogram/**/*.test.ts'],
    environment: 'node',
  },
})
