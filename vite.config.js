import { defineConfig } from 'vite'

export default defineConfig({
  base: "/worldspecs/",
  build: {
    target: "esnext" // Needed so that build can occur with the top-level 'await' statements,
  }
})
