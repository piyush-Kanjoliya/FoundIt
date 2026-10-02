import {defineConfig} from 'vite'
export default defineConfig({
  esbuild: {jsx: 'automatic', jsxImportSource: 'react'},
  envDir: '..',
  server: {port: 5173, strictPort: true, proxy: {'/api': 'http://localhost:8080'}},
  build: {outDir: 'dist'}
})
