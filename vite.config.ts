import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // 开发服务器配置
  server: {
    port: 3000,
    open: '/demo/index.html',
  },

  // 构建配置（库模式）
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'HowdzCAD',
      formats: ['es', 'umd'],
      fileName: 'howdz-online-cad',
    },
    rollupOptions: {
      // 外部依赖（如果有）
      external: [],
      output: {
        globals: {},
      },
    },
    sourcemap: true,
    minify: 'esbuild',
  },
});
