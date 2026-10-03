import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    environmentOptions: { happyDOM: { url: "http://localhost/global-rare-ebird/" } },
  },
});
