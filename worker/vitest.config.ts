import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(`${root}/worker/migrations`);
      return {
        wrangler: { configPath: `${root}/wrangler.jsonc` },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      };
    }),
  ],
  test: {
    include: ['worker/test/**/*.test.ts'],
    setupFiles: ['worker/test/apply-migrations.ts'],
  },
});
