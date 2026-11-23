#!/usr/bin/env node
// DevCo PreToolUse guard (Sprint 0, S0-10). Second line of defence behind Cezar's bashAllowlist.
// Claude Code passes the tool call as JSON on stdin; exit code 2 blocks it and shows stderr to
// the agent. Zero dependencies. Regexes are built from parts so this file never matches the
// sandbox secret scanner.
import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

// Fail closed: an uncaught error exits 1, which Claude Code treats as non-blocking (review on #45).
process.on('uncaughtException', (error) => {
  console.error(`devco guard: internal error, blocking (${error && error.message})`);
  process.exit(2);
});

let call;
try {
  call = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  console.error('devco guard: unreadable tool call, blocking');
  process.exit(2);
}
const tool = call.tool_name ?? '';
const input = call.tool_input ?? {};
const block = (why) => {
  console.error(`devco guard blocked ${tool}: ${why}`);
  process.exit(2);
};

const DENY_BASH = [
  [/\bgit\s+push\b[^\n]*(\s--force\b|\s-f\b|\s--force-with-lease\b)/, 'force push'],
  [/\bgit\s+push\b[^\n]*\b(main|master)\b/, 'push to a protected branch'],
  // PR merge and un-draft are checked on shell words below (prCommandText, checkUndraft).
  [/\bgh\s+(repo\s+(delete|edit|create)|secret|auth|api|alias)\b/, 'gh admin/API/alias command'],
  [/\b(sudo|su)\b/, 'privilege escalation'],
  [/\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\$HOME)(\s|$)/, 'recursive delete of / or home'],
  [/\b(curl|wget)\b[^\n|]*\|\s*(ba|z)?sh\b/, 'pipe download to shell'],
  [/\b(printenv|env)\s*($|\|)|\bset\s*$/, 'environment dump'],
  [/\bsecurity\s+(find|dump)-/, 'keychain read'],
  [/(~|\$HOME)\/\.(ssh|aws|config\/gh|claude)\b/, 'reading credential folders'],
  [/\bnpm\s+(publish|login|adduser|token)\b/, 'npm publish/auth'],
  [/\bchmod\s+[0-7]*777\b/, 'world-writable permissions'],
  // git options that read or write arbitrary files or run programs (review round 4, B2). Confined
  // agents have no shell at all; this is defence in depth for any session that still has one.
  [/\bgit\b[^\n]*\s--output(=|\s|$)/, 'git --output (writes an arbitrary file)'],
  [/\bgit\b[^\n]*\s--no-index\b/, 'git --no-index (reads files outside the repository)'],
  [/\bgit\b[^\n]*\s--ext-diff\b/, 'git --ext-diff (runs an external program)'],
  [/\bgit\b[^\n]*\s--textconv\b/, 'git --textconv (runs a conversion program)'],
  [/\bgit\b[^\n]*\s-O\S*/, 'git -O (reads an order file / opens files in a pager)'],
  [/\bgit\b[^\n]*\s--open-files-in-pager\b/, 'git --open-files-in-pager (runs a program)'],
  [/\bgit\b[^\n]*\s--exec(-path)?\b/, 'git --exec (runs a program)'],
  [/\bgit\b[^\n]*\s(-c\s*\S|--config(-env)?\b)/, 'git -c / --config (overrides configuration, e.g. a pager or diff driver)'],
];

// Exact files agents may edit despite a protected prefix (CTO decision, 2026-11-15); matches DEVCO_AGENT_EDITABLE.
// Matched case-sensitively: on Linux `.github/workflows/DevCo-CI.yml` is a different, protected workflow.
const AGENT_EDITABLE = ['.github/workflows/devco-ci.yml'];
// Mirrors DEVCO_PROTECTED_PREFIXES / _NAMES / _DIR_NAMES in packages/contract/src/devco.ts (the merge
// gate's list), plus .git/. Case-insensitive (fail closed): on macOS's APFS `.CLAUDE/x` is `.claude/x`.
const PROTECTED_PREFIXES = ['.claude/', '.mcp.json', '.ai/', '.devco/scripts/', '.devco/reviews/', '.devco/tasks/', '.devco/decisions/', '.devco/sprint.json', '.devco/visual-qa.json', 'scripts/', '.github/', '.gitattributes', '.gitmodules', '.git/'];
const PROTECTED_NAMES = ['claude.md', 'claude.local.md'];
const PROTECTED_DIR_NAMES = ['.claude'];
const fold = (s) => s.normalize('NFC').toLocaleLowerCase('en-US').replace(/\u017f/g, 's');
function isProtected(rel) {
  const lc = fold(rel);
  if (PROTECTED_PREFIXES.some((p) => (p.endsWith('/') ? lc === p.slice(0, -1) || lc.startsWith(p) : lc === p))) return true;
  const parts = lc.replace(/\/+$/, '').split('/');
  return PROTECTED_NAMES.includes(parts[parts.length - 1]) || parts.some((part) => PROTECTED_DIR_NAMES.includes(part));
}

/** The real path of `path`, resolving symlinks in the deepest part of it that exists. */
function realish(path) {
  let head = path;
  const tail = [];
  for (;;) {
    try {
      return [realpathSync.native(head), ...tail.reverse()].join(sep); // native: the on-disk name and case (APFS folds .CLAUDE, ſcripts)
    } catch {
      let link = false;
      try { link = lstatSync(head).isSymbolicLink(); } catch { /* missing: walk up */ }
      if (link) return null; // a dangling symlink: its target is unknown, refuse (review round 2)
      const up = dirname(head);
      if (up === head) return path;
      tail.push(head.slice(up.length + (up.endsWith(sep) ? 0 : 1)));
      head = up;
    }
  }
}

const p = (s) => s; // keeps the parts below readable
const SECRET_SHAPES = [
  new RegExp(p('\\b(gh') + p('p|gho|ghu|ghs|ghr)_') + '[A-Za-z0-9]{36,}'),
  new RegExp(p('github') + p('_pat_') + '[A-Za-z0-9_]{22,}'),
  new RegExp(p('\\bAK') + p('IA') + '[0-9A-Z]{16}\\b'),
  new RegExp(p('\\bsk') + p('-') + '[A-Za-z0-9_-]{20,}'),
  new RegExp(p('-----BEGIN ') + '(?:[A-Z]+ )?' + p('PRIVATE ') + 'KEY-----'),
];

/** Shell words per simple command, quotes removed; null when the quoting cannot be read. */
function shellSegments(cmd) {
  const segs = [[]];
  let word = null;
  let target = false; // the next word is a redirection's target, which the command never sees
  const end = () => {
    if (word !== null && !target) segs[segs.length - 1].push(word);
    if (word !== null) target = false;
    word = null;
  };
  for (let i = 0; i < cmd.length;) {
    const c = cmd[i];
    if (c === '<' || c === '>' || (c === '&' && cmd[i + 1] === '>')) {
      // A redirection: `2>x`, `>&2`, `&>x`, `>>x`, `<x`. Bash removes it before the command runs.
      if (c !== '&' && word !== null && /^\d+$/.test(word)) word = null;
      else end();
      for (i++; /[<>&|]/.test(cmd[i] ?? ''); i++);
      target = true;
    } else if (c === "'") {
      const j = cmd.indexOf("'", i + 1);
      if (j < 0) return null;
      word = (word ?? '') + cmd.slice(i + 1, j);
      i = j + 1;
    } else if (c === '"') {
      let v = '';
      for (i++; cmd[i] !== '"'; i++) {
        if (i >= cmd.length) return null;
        if (cmd[i] === '\\' && cmd[i + 1] === '\n') { i++; continue; } // a line continuation, even quoted
        if (cmd[i] === '\\' && '"\\$`'.includes(cmd[i + 1] ?? '')) i++;
        v += cmd[i];
      }
      word = (word ?? '') + v;
      i++;
    } else if (c === '\\') {
      if (cmd[i + 1] !== '\n') word = (word ?? '') + (cmd[i + 1] ?? '\\');
      i += 2;
    } else if (c === '#' && word === null) {
      while (i < cmd.length && cmd[i] !== '\n') i++; // a comment: the shell runs none of it
    } else if (/[;&|()\n]/.test(c)) {
      end();
      target = false;
      segs.push([]);
      i++;
    } else if (/\s/.test(c)) {
      end();
      i++;
    } else {
      word = (word ?? '') + c;
      i++;
    }
  }
  end();
  return segs.filter((s) => s.length);
}

// Commands that never run their arguments, so a quoted body (`ao send --message "…"`) is only text.
const QUOTE_SAFE = (s) => (s[0] === 'ao' && ['send', 'report'].includes(s[1])) || s[0] === 'grep' || (s[0] === 'gh' && ['pr', 'issue'].includes(s[1]));
/**
 * The word lists the PR rules read. Each command's shell words go in as gh receives them, never
 * re-split, so a quoted flag or value keeps its boundaries whatever it holds (reviews of #245).
 * When every command is quote-safe and nothing is substituted or fed from a heredoc, those are all.
 * Otherwise (fail closed) also the raw command and the same without quotes and backslashes, split on
 * blanks and shell operators, so code nested in a string (`sh -c "…"`) still matches (review of #243).
 */
function prCommandText(cmd) {
  const segs = shellSegments(cmd);
  if (!segs || /`|\$\(|\$'|[<>]\(|<</.test(cmd) || !segs.every(QUOTE_SAFE)) {
    const split = (text) => text.split(/[\s;&|()<>]+/).filter(Boolean);
    return { quoteSafe: false, lists: [split(cmd), split(cmd.replace(/["'\\]/g, '')), ...(segs ?? [])] };
  }
  return { quoteSafe: true, lists: segs };
}

/**
 * Indexes of the words gh would read as the next (sub)command after `t[start - 1]`: flags are skipped,
 * with `-R`/`--repo`'s value; an unknown flag may or may not take one, so both readings count.
 */
function commandWordIndexes(t, start) {
  const out = [];
  const seen = new Set();
  for (const todo = [start]; todo.length;) {
    const j = todo.pop();
    if (j >= t.length || seen.has(j)) continue;
    seen.add(j);
    const w = t[j];
    if (!w.startsWith('-')) out.push(j);
    else if (w === '-R' || w === '--repo') todo.push(j + 2);
    else if (w.includes('=') || w === '-h' || w === '--help' || /^-R./.test(w)) todo.push(j + 1);
    else todo.push(j + 1, j + 2);
  }
  return out;
}
const EXPANSION = /[$`*?[{]/; // a variable, substitution, glob or brace: the word the shell runs is unknown

/** What the PR rules find in the word lists: a merge, an un-draft, or a gh command word they cannot read. */
function prSubcommands({ lists, quoteSafe }) {
  const found = new Set();
  for (const t of lists) t.forEach((w, i) => {
    // Quote-safe commands never run their arguments, so there only a leading gh is a command. Elsewhere
    // any letter case (APFS runs `GH`), and an expansion followed by `pr` may be gh too (`$G pr …`).
    const ghLike = quoteSafe ? i === 0 && w === 'gh' : /(^|\W)gh$/i.test(w);
    if (!ghLike && !(!quoteSafe && EXPANSION.test(w))) return;
    for (const c of commandWordIndexes(t, i + 1)) {
      if (!ghLike) { if (t[c] === 'pr') found.add('expansion'); continue; }
      if (EXPANSION.test(t[c])) found.add('expansion');
      if (t[c] !== 'pr') continue;
      for (const s of commandWordIndexes(t, c + 1)) {
        if (EXPANSION.test(t[s])) found.add('expansion');
        else if (/^(merge|ready)\b/.test(t[s])) found.add(t[s].slice(0, 5));
      }
    }
  });
  return found;
}

// Un-draft is held for the owner when the PR changes any of these (owner policy, 2026-11-22). The
// secret-file rows mirror devcoIsSecretFilePath (packages/contract/src/devco.ts), which the merge gate
// re-checks on the final head, so a secret file pushed after un-draft still cannot merge.
const UNDRAFT_PROTECTED = [
  /^\.github\/(workflows|actions)\//, // actions: composite actions run in CI with its secrets
  /(^|\/)\.claude\/hooks\//,
  /(^|\/)\.claude\/settings(\.local)?\.json$/, // wires the hooks
  /(^|\/)\.env(rc|\.[^/]+)?$/, // .envrc runs as shell (direnv); .env.example / .sample / .template are excluded below
  /(^|\/)(\.npmrc|\.netrc|\.pypirc|\.pgpass|\.htpasswd)$/,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)[^/]*$/,
  /\.(pem|key|p12|pfx|jks|keystore|kdbx|ppk)$/,
  /(^|\/)\.?(secrets?|credentials?)(\/|(\.(json|ya?ml|toml|ini|env|txt|cfg|conf|properties|xml|plist))?$)/,
  /(^|\/)(client_secret|service[-_]account)[^/]*\.json$/,
];
const undraftProtected = (path) => {
  const lc = fold(path);
  return !/(^|\/)\.env\.(example|sample|template)$/.test(lc) && UNDRAFT_PROTECTED.some((re) => re.test(lc));
};

/** Agents may un-draft their OWN PR (owner policy, 2026-11-22): this branch's PR, no protected path. */
function checkUndraft(cmd) {
  const m = /^\s*gh\s+pr\s+ready(?:\s+#?(\d+))?\s*$/.exec(cmd);
  if (!m) block('un-draft only as a bare `gh pr ready [<number>]`, so the guard can check the PR');
  const cwd = call.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const run = (bin, args) => spawnSync(bin, args, { cwd, encoding: 'utf8', timeout: 20_000 });
  const head = run('git', ['symbolic-ref', '--short', '-q', 'HEAD']);
  const branch = head.status === 0 ? head.stdout.trim() : '';
  if (!branch) block('un-draft: cannot read the current branch (fail closed)');
  const view = run('gh', ['pr', 'view', ...(m[1] ? [m[1]] : []), '--json', 'headRefName,isCrossRepository,changedFiles,files']);
  let pr = null;
  try { if (view.status === 0) pr = JSON.parse(view.stdout); } catch { /* unreadable: blocked below */ }
  const files = Array.isArray(pr?.files) ? pr.files.map((f) => f?.path) : null;
  if (!files || files.length !== pr.changedFiles || !files.every((f) => typeof f === 'string' && f)) {
    block("un-draft: cannot read the PR's full changed-file list (fail closed)");
  }
  if (pr.isCrossRepository !== false || pr.headRefName !== branch) block(`un-draft: not this branch's PR (${branch}); only your own PR`);
  const held = files.filter(undraftProtected);
  if (held.length) block(`un-draft: the PR touches protected paths (${held.slice(0, 3).join(', ')}); the owner un-drafts it`);
}

if (tool === 'Bash') {
  const cmd = String(input.command ?? '');
  for (const [re, why] of DENY_BASH) if (re.test(cmd)) block(why);
  for (const re of SECRET_SHAPES) if (re.test(cmd)) block('secret-shaped value in a command');
  const pr = prSubcommands(prCommandText(cmd));
  if (pr.has('merge')) block('merging a PR (DevCo CI merges, never an agent)');
  if (pr.has('expansion')) block('a gh command or PR subcommand from a variable, substitution or glob (fail closed)');
  if (pr.has('ready')) checkUndraft(cmd);
  process.exit(0);
}

if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
  // Normalise before matching (review round 3, M1): `a/../.claude/x`, `./.claude//x` and a
  // symlinked parent all resolve to the same real path, which must stay inside the worktree.
  const root = realish(resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd()));
  const raw = String(input.file_path ?? input.notebook_path ?? '');
  if (!raw) block('no file path');
  const target = realish(resolve(root, raw));
  if (target === null) block(`write through a dangling symlink (${raw})`);
  const rel = relative(root, target);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) block(`write outside the worktree (${raw})`);
  const relPosix = rel.split(sep).join('/');
  if (!AGENT_EDITABLE.includes(relPosix)) if (isProtected(relPosix)) block(`${relPosix} is owned by QA/DevOps, not the implementing agent`);
  const text = [input.content, input.new_string, input.new_source, ...(input.edits ?? []).map((e) => e.new_string)]
    .filter(Boolean)
    .join('\n');
  for (const re of SECRET_SHAPES) if (re.test(text)) block('secret-shaped value in file content');
}
process.exit(0);
