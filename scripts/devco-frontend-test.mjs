// The `check:frontend-test` step of the root `npm run check`. All the logic is in devco-check-runner.mjs.
import { fileURLToPath } from 'node:url';
import { runFrontendTests } from './devco-check-runner.mjs';

process.exitCode = runFrontendTests({
  repo: fileURLToPath(new URL('..', import.meta.url)),
  env: process.env,
  args: process.argv.slice(2),
});
