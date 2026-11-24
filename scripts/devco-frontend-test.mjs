// Runs the frontend unit tests for the root `npm run check`, which DevCo (Cezar) runs.
// Without CEZ_CHECK_SANDBOX=1 this is exactly `npm --prefix frontend test`; with it, the tests in
// devco-sandbox-skips.mjs are left out. GitHub CI does not call this file.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SKIPPED_FILES, SKIPPED_TESTS, vitestRuns } from './devco-sandbox-skips.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));

const runs = vitestRuns(process.env);
if (runs.length > 1) {
  console.log('CEZ_CHECK_SANDBOX=1: these tests cannot run in the check sandbox (GitHub CI runs them):');
  for (const { file, reason } of SKIPPED_FILES) console.log(`  ${file}: ${reason}`);
  for (const { file, reason, suites = [], tests = [] } of SKIPPED_TESTS) console.log(`  ${file} (${[...suites, ...tests].join('; ')}): ${reason}`);
}
// Git-ignored, but Cezar counts ignored files as changes, so it is removed again (and a leftover
// from a killed run is removed first).
const temp = `${REPO}.cache/devco-check-tmp`;
let failed = false;
for (const { args, worktreeTemp } of runs) {
  try {
    if (worktreeTemp) {
      rmSync(temp, { recursive: true, force: true });
      mkdirSync(temp, { recursive: true });
    }
    const env = worktreeTemp ? { ...process.env, TMPDIR: temp } : process.env;
    const result = spawnSync('npm', ['--prefix', 'frontend', 'test', ...(args.length ? ['--', ...args] : [])], { cwd: REPO, env, stdio: 'inherit' });
    if (result.error) console.error(result.error.message);
    if (result.status !== 0) failed = true;
  } finally {
    if (worktreeTemp) rmSync(temp, { recursive: true, force: true });
  }
}
process.exitCode = failed ? 1 : 0;
