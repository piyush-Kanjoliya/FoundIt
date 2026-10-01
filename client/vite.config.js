import {defineConfig} from 'vite';
export default defineConfig({envDir:'..',server:{port:5173,strictPort:true,proxy:{'/api':'http://localhost:8080'}},build:{outDir:'dist'}});
