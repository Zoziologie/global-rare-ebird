import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };

  return {
    plugins: [vue()],
    base: "/global-rare-ebird/",
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/mapbox-gl")) {
              return "mapbox-gl";
            }

            if (id.includes("node_modules")) {
              return "vendor";
            }
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
