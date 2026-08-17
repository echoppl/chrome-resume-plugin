import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        table: resolve(__dirname, 'table.html'),
        form: resolve(__dirname, 'form.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        'content-zhipin': resolve(__dirname, 'src/content/zhipin.ts'),
        'content-liepin': resolve(__dirname, 'src/content/liepin.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background.js';
          if (chunk.name === 'content-zhipin') return 'content-zhipin.js';
          if (chunk.name === 'content-liepin') return 'content-liepin.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: () => 'assets/[name]-[hash][extname]',
        manualChunks: (id) => {
          if (id.includes('vue')) return 'vue-vendor';
          if (id.includes('element-plus')) return 'element-plus-vendor';
        },
      },
      onwarn(warning, warn) {
        if (
          warning.code === 'INVALID_ANNOTATION' &&
          warning.message?.includes('#__PURE__')
        ) {
          return;
        }
        warn(warning);
      },
    },
    minify: 'terser',
  },
});