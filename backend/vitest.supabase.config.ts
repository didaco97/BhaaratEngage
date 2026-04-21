import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      BHAARATENGAGE_LOAD_LOCAL_ENV: "true",
    },
    include: ["tests/supabase-*.test.ts"],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
});
