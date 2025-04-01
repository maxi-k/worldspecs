import { defineConfig } from 'vite'

export default defineConfig({
  base: "/EC2Bench/",
  build: {
    target: "esnext" // Needed so that build can occur with the top-level 'await' statements,
  }
})