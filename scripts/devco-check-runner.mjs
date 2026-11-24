// Runs the frontend unit tests for the root `npm run check`, which DevCo (Cezar) runs. In Cezar's check
// sandbox the tests in devco-sandbox-skips.mjs are left out; anywhere else this is exactly
// `npm --prefix frontend test`. GitHub CI does not call this file.
// Tested by frontend/scripts/devco-check-runner.test.mjs.
import { spawnSync } from 'node:child_process';
import { chmodSync, lstatSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { SKIPPED_FILES, SKIPPED_TESTS, isCheckSandbox, vitestRuns } from './devco-sandbox-skips.mjs';

/** Returns the exit code: 0 only if every run passed, otherwise that of the first failure. */
export function runFrontendTests({ repo, env, args = [], platform = process.platform, spawn = spawnSync, out = console }) {
  // Arguments could narrow the run, and the lists are the only place that may.
  if (args.length > 0) {
    out.error(`The frontend test check takes no arguments: ${args.join(' ')}`);
    return 2;
  }
  let exitCode = 0;
  const fail = (code, message) => {
    if (message) out.error(message);
    exitCode ||= code;
  };
  const sandboxed = isCheckSandbox(env);
  const cache = path.join(repo, '.cache');
  const temp = path.join(cache, 'devco-check-tmp');
  if (sandboxed) {
    try {
      removeTemp(cache, temp);
    } catch (error) {
      fail(1, error.message);
      return exitCode;
    }
    out.log('CEZ_CHECK_SANDBOX=1: these tests cannot run in the check sandbox and are left to GitHub CI:');
    for (const { file, reason } of SKIPPED_FILES) out.log(`  ${file}: ${reason}`);
    for (const { file, reason, suites = [], tests = [] } of SKIPPED_TESTS) out.log(`  ${file} (${[...suites, ...tests].join('; ')}): ${reason}`);
  }
  // Windows has npm.cmd, which Node only runs through a shell; npm_execpath is npm's own script.
  const npm = platform === 'win32' && env.npm_execpath ? [process.execPath, env.npm_execpath] : ['npm'];
  for (const { args: testArgs, worktreeTemp } of vitestRuns(env)) {
    try {
      if (worktreeTemp) {
        removeTemp(cache, temp);
        mkdirSync(temp, { recursive: true });
      }
      const command = [...npm, '--prefix', 'frontend', 'test', ...(testArgs.length ? ['--', ...testArgs] : [])];
      const runEnv = sandboxed ? sandboxEnv(env, repo, worktreeTemp ? temp : undefined) : env;
      const result = spawn(command[0], command.slice(1), { cwd: repo, env: runEnv, stdio: 'inherit' });
      if (result.error || result.status !== 0) {
        fail(result.status || 1, result.error?.message ?? (result.signal ? `The frontend tests were stopped by ${result.signal}` : ''));
      }
    } catch (error) {
      fail(1, error.message);
    }
    if (worktreeTemp) {
      // Git-ignored, but Cezar counts ignored files as changes.
      try {
        removeTemp(cache, temp);
      } catch (error) {
        fail(1, `Could not remove ${temp}: ${error.message}`);
      }
    }
  }
  return exitCode;
}

// Loading the electron package looks for its binary, and downloads it if it is missing. Some tests
// load the package but none of those that run here use the binary; with this set the package only
// builds a path from it.
function sandboxEnv(env, repo, temp) {
  return {
    ...env,
    ELECTRON_OVERRIDE_DIST_PATH: path.join(repo, 'frontend', 'node_modules', 'electron', 'dist'),
    ...(temp ? { TMPDIR: temp } : {}),
  };
}

function removeTemp(cache, temp) {
  const stat = lstatSync(cache, { throwIfNoEntry: false });
  if (!stat) return;
  // Through a symlink this would delete a folder somewhere else.
  if (!stat.isDirectory()) throw new Error(`${cache} is not a real folder (a symlink or a file), so it is left alone`);
  try {
    rmSync(temp, { recursive: true, force: true });
  } catch (error) {
    // A failed test can leave a read-only folder behind.
    if (!lstatSync(temp, { throwIfNoEntry: false })?.isDirectory()) throw error;
    makeWritable(temp);
    rmSync(temp, { recursive: true, force: true });
  }
}

function makeWritable(folder) {
  chmodSync(folder, 0o700);
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) makeWritable(path.join(folder, entry.name));
  }
}
