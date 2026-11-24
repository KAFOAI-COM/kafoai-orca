// What the root `npm run check` leaves out when DevCo (Cezar) runs it in its check sandbox, and why.
// Used by devco-frontend-test.mjs, only when CEZ_CHECK_SANDBOX=1. GitHub CI never sets that flag, so
// CI runs every test listed here.
//
// The sandbox (KAFOAI-COM/cezar-devco, packages/cezar/src/core/check-sandbox.ts) denies all network,
// loopback and Unix sockets included, and runs programs only from the system folders, the Node
// install and the worktree.
//
// This file lives under scripts/ on purpose: scripts/ is a DevCo protected path, so a DevCo agent
// cannot widen the lists.

// Paths are relative to frontend/. A file is listed whole only if no test in it can run in the
// sandbox.
export const SKIPPED_FILES = [
  // Opens a local server in every test.
  { file: 'src/main/remote-proxy.test.ts', kind: 'server', reason: 'startRemoteProxy listens on 127.0.0.1, and the tests serve their own HTTP, HTTP/2 and WebSocket upstreams' },
  { file: 'src/main/browser-runtime-link.test.ts', kind: 'server', reason: 'each test listens on 127.0.0.1 as the daemon side of the link' },
  { file: 'src/main/supervisor-link.test.ts', kind: 'server', reason: 'each test listens on a Unix socket; Unix sockets are denied like TCP' },
  { file: 'src/main/agent-browser-cdp-bridge.test.ts', kind: 'server', reason: 'the AgentBrowserCDPBridge constructor opens a WebSocket server on 127.0.0.1' },
  { file: 'src/renderer/hooks/useSessionWorkspaceFiles.network.test.ts', kind: 'server', reason: 'each test serves a daemon over HTTP on 127.0.0.1 (one also on ::1)' },
  { file: 'scripts/blockmap-reconstruction.test.mjs', kind: 'server', reason: 'runDownload, which every test calls, serves the update files on 127.0.0.1' },
  { file: 'scripts/mac-differential-v2-updater.test.mjs', kind: 'server', reason: 'runCase, which every test calls, serves the update files on 127.0.0.1' },
  // Needs the Electron binary, which the electron package downloads when it is first loaded.
  { file: 'src/main/browser-view-host.test.ts', kind: 'binary', reason: 'its electron mock loads the real electron package (importOriginal)' },
  { file: 'src/main/provider-auth-flow.test.ts', kind: 'binary', reason: 'provider-auth-flow.ts imports electron, and the test does not mock it' },
];

// Files where only the named tests or whole describe blocks are skipped; the rest of the file runs.
export const SKIPPED_TESTS = [
  {
    file: 'src/main/cloud-agent-proxy.test.ts', kind: 'server', reason: 'startCp serves a control plane on 127.0.0.1',
    tests: [
      "cloud agent proxy > serves a cloud session's agent browser on its own origin once the control plane says it has one",
      'cloud agent proxy > gives no agent browser when the sandbox has none, the control plane is unreachable, or no one is signed in',
      'cloud agent proxy > sends the bearer only to the configured control plane',
      "cloud agent proxy > waits out the control plane's Retry-After for a session whose agent browser is not connected",
      "cloud agent proxy > gives no agent browser while the sandbox's has not started: showing it would start it",
      'cloud agent proxy > tries again after its server failed to start',
      "cloud agent proxy > keeps a session's origin across restarts, and only with the same secret",
      "cloud agent proxy > forwards the viewer's requests with the bearer and without its own credentials",
      'cloud agent proxy > refuses other origins, hosts and routes before the control plane sees them',
      'cloud agent proxy > answers 502 when the control plane is unreachable',
      "cloud agent proxy > bridges the viewer's socket to the control plane with the bearer",
      'cloud agent proxy > refuses a socket from another origin or for an unknown host',
    ],
  },
  {
    file: 'src/main/remotes-main.test.ts', kind: 'server', reason: 'each serves a remote host on 127.0.0.1',
    tests: [
      'registerRemotesIpc > saves the observed host ID and authenticates only after the identity probe',
      'registerRemotesIpc > refuses a changed host before sending the saved password',
      'registerRemotesIpc > reports an incompatible host before sending or saving its credential',
      'registerRemotesIpc > links a paired host to the account without returning its token',
    ],
  },
  {
    file: 'src/main/render-check-proxy.test.ts', kind: 'server', reason: 'startRenderCheckProxy listens on 127.0.0.1',
    suites: ['render-check proxy', 'render-check proxy with no network', 'startRenderCheckProxy'],
  },
  {
    file: 'src/shared/daemon-attach.test.ts', kind: 'server', reason: 'startServer serves a daemon on 127.0.0.1',
    suites: ['end-to-end against a real daemon server'],
  },
  {
    // Neither a local server nor a downloaded binary: the one skip outside the brief.
    file: 'src/main/process-start.test.ts', kind: 'other', reason: 'runs /bin/ps, which is setuid root; the sandbox refuses to run it (Operation not permitted)',
    tests: ['readProcessStartMs > reads the real start time of a live process'],
  },
];

// Nothing is skipped here. These write small scripts into the temp folder and run them, but the
// sandbox runs nothing from Cezar's temp folder. They get a temp folder inside the worktree.
export const RUNS_TEMP_SCRIPTS = [
  'scripts/verify-mac-artifact.test.mjs',
  'src/shared/cli-link.test.ts',
  'src/shared/cli-shadow.test.ts',
];

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Vitest matches -t against the describe and test titles joined with spaces.
const fullName = (title) => escapeRegex(title.replaceAll(' > ', ' '));

/** The -t pattern that matches every test except the ones listed in SKIPPED_TESTS. */
export function keepPattern() {
  const skipped = SKIPPED_TESTS.flatMap(({ suites = [], tests = [] }) => [...suites.map((suite) => `${fullName(suite)} .*`), ...tests.map(fullName)]);
  return `^(?!(?:${skipped.join('|')})$)`;
}

/** The vitest runs for this environment: extra arguments, and whether the temp folder is in the worktree. */
export function vitestRuns(env) {
  if (env.CEZ_CHECK_SANDBOX !== '1') return [{ args: [], worktreeTemp: false }];
  // The name filter applies to every file of a run, so the filtered files get a run of their own.
  const separate = [...SKIPPED_TESTS.map(({ file }) => file), ...RUNS_TEMP_SCRIPTS];
  return [
    { args: [...SKIPPED_FILES.map(({ file }) => file), ...separate].flatMap((file) => ['--exclude', file]), worktreeTemp: false },
    { args: [...separate, '-t', keepPattern()], worktreeTemp: true },
  ];
}
