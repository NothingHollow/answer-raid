import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, loadEnv } from 'vite'
import { raidApi } from './server/vite-api.ts'

// 相对 base:产物可直接丢到任意静态托管 / 本地 file:// 之外的任意子路径下。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'DATABASE_URL');
  if (!process.env.DATABASE_URL && env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
  return {
  base: './',
  plugins: [svelte(), raidApi()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
  },
  };
})
