import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ["tests/**/*.test.js"],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    environmentOptions: { happyDOM: { url: "http://localhost/global-rare-ebird/" } },
  },
});
