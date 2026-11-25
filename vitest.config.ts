import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tools/formats/src/**/*.test.ts',
      'tools/viewer-check/**/*.test.ts',
      'tools/duel-metrics/**/*.test.ts',
      'engine/platform/src/**/*.test.ts',
      'engine/render/src/**/*.test.ts',
      'engine/**/*.test.ts',
      'web/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
  },
});
