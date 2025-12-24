import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  root: '.',      // IMPORTANT: this folder is root
  base: './',     // relative paths for static deploy
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  css: {
    postcss: {
      plugins: [require('tailwindcss'), require('autoprefixer')]
    }
  }
})
