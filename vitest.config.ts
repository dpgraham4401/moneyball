import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true }, // resolve "@/..." imports like Next does
});
