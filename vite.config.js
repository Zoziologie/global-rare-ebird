import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };

  if (env.MAPBOX_ACCESS_TOKEN?.startsWith("sk.")) {
    throw new Error("MAPBOX_ACCESS_TOKEN must be a public token (pk.), because it is bundled in the website.");
  }

  return {
    plugins: [vue()],
    base: "/global-rare-ebird/",
    optimizeDeps: { entries: ["index.html"] },
    json: { stringify: true },
    build: {
      chunkSizeWarningLimit: 2000,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: "mapbox-gl", test: /node_modules\/mapbox-gl/, priority: 10 },
              { name: "vendor", test: /node_modules/ },
            ],
          },
        },
      },
    },
    define: {
      "import.meta.env.MAPBOX_ACCESS_TOKEN": JSON.stringify(
        env.MAPBOX_ACCESS_TOKEN || ""
      ),
      "import.meta.env.EBIRD_API_KEY": JSON.stringify(env.EBIRD_API_KEY || ""),
    },
  };
});
