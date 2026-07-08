import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 是否构建 demo 模式
const isDemo = process.env.BUILD_MODE === 'demo';

export default defineConfig({
  // 开发服务器配置
  server: {
    port: 3000,
    open: '/demo/index.html',
  },

  // Demo 模式下设置 root 为 demo 目录的父目录
  root: isDemo ? resolve(__dirname) : undefined,

  // Demo 模式使用 singlefile 插件
  plugins: isDemo ? [viteSingleFile()] : [],

  // 构建配置
  build: isDemo
    ? {
        // Demo 模式：打包成独立 HTML
        rollupOptions: {
          input: resolve(__dirname, 'demo/index.html'),
          output: {
            entryFileNames: 'assets/[name]-[hash].js',
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]',
          },
        },
        outDir: 'dist-demo',
        emptyOutDir: true,
        sourcemap: false,
        minify: 'esbuild',
      }
    : {
        // 库模式：打包成 npm 包
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'HowdzCAD',
          formats: ['es', 'umd'],
          fileName: 'howdz-online-cad',
        },
        rollupOptions: {
          external: [],
          output: {
            globals: {},
          },
        },
        sourcemap: true,
        minify: 'esbuild',
      },
});
