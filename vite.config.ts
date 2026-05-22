import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit(), svelteTesting()],
  // Pin the dev server to a project-dedicated port so it never collides with
  // other local services. strictPort fails loudly instead of drifting to a
  // random port if 2137 is already taken.
  server: {
    port: 2137,
    strictPort: true
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,svelte}'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.svelte',
        'src/test-setup.ts',
        'src/app.d.ts',
        'src/domain/test-support.ts'
      ]
    }
  }
});
