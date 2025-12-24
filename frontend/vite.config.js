import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  root: '.',                  // frontend folder
  base: './',                 // relative paths for static deployment
  build: {
    outDir: 'dist',           // output directory
    rollupOptions: {
      input: resolve(__dirname, 'public/index.html')  // <- THIS FIXES THE ERROR
    }
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  }
})
