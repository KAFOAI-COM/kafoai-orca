// @vitest-environment node
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runFrontendTests } from "../../scripts/devco-check-runner.mjs";
import { vitestRuns } from "../../scripts/devco-sandbox-skips.mjs";

const SANDBOX = { CEZ_CHECK_SANDBOX: "1", PATH: "/usr/bin" };
let repo;
let outside;
let out;

beforeEach(() => {
	repo = mkdtempSync(path.join(os.tmpdir(), "devco-check-repo-"));
	outside = mkdtempSync(path.join(os.tmpdir(), "devco-check-outside-"));
	out = { log: vi.fn(), error: vi.fn() };
});

afterEach(() => {
	for (const folder of [repo, outside]) rmSync(folder, { recursive: true, force: true });
});

const temp = () => path.join(repo, ".cache", "devco-check-tmp");
const passing = () => vi.fn(() => ({ status: 0 }));
// A spawn whose runs end with these results, in order.
const ending = (...results) => vi.fn(() => results.shift());
const run = (spawn, env = SANDBOX, options = {}) => runFrontendTests({ repo, env, spawn, out, ...options });

// A folder outside the repository with something in it that must survive.
function precious() {
	const keep = path.join(outside, "devco-check-tmp", "keep.txt");
	mkdirSync(path.dirname(keep), { recursive: true });
	writeFileSync(keep, "keep");
	return keep;
}

describe("DevCo frontend check runner", () => {
	it.each([
		["without the flag", { PATH: "/usr/bin" }],
		["with the flag under GitHub Actions", { ...SANDBOX, GITHUB_ACTIONS: "true" }],
	])("runs plain npm test %s, in an unchanged environment", (_when, env) => {
		const spawn = passing();
		expect(run(spawn, env)).toBe(0);
		expect(spawn).toHaveBeenCalledExactlyOnceWith("npm", ["--prefix", "frontend", "test"], { cwd: repo, env, stdio: "inherit" });
		expect(spawn.mock.calls[0][2].env).toBe(env);
		expect(out.log).not.toHaveBeenCalled();
		expect(existsSync(path.join(repo, ".cache"))).toBe(false);
	});

	it("makes both sandbox runs, and only the second with a temp folder in the worktree", () => {
		const tempExisted = [];
		const spawn = vi.fn(() => {
			tempExisted.push(existsSync(temp()));
			return { status: 0 };
		});
		expect(run(spawn)).toBe(0);
		const [rest, separate] = vitestRuns(SANDBOX);
		expect(spawn.mock.calls.map(([command, args]) => [command, args])).toEqual([
			["npm", ["--prefix", "frontend", "test", "--", ...rest.args]],
			["npm", ["--prefix", "frontend", "test", "--", ...separate.args]],
		]);
		const electron = path.join(repo, "frontend", "node_modules", "electron", "dist");
		expect(spawn.mock.calls.map(([, , { env }]) => env)).toEqual([
			{ ...SANDBOX, ELECTRON_OVERRIDE_DIST_PATH: electron },
			{ ...SANDBOX, ELECTRON_OVERRIDE_DIST_PATH: electron, TMPDIR: temp() },
		]);
		expect(tempExisted).toEqual([false, true]);
		expect(existsSync(temp())).toBe(false);
		expect(out.log).toHaveBeenCalled();
	});

	it.each([
		["the first run's", [{ status: 3 }, { status: 0 }], 3],
		["the second run's", [{ status: 0 }, { status: 5 }], 5],
		["the first failure's, when both fail", [{ status: 3 }, { status: 5 }], 3],
		["1 for a run stopped by a signal", [{ status: 0 }, { status: null, signal: "SIGKILL" }], 1],
		["1 for a run that did not start", [{ status: null, error: new Error("spawn npm ENOENT") }, { status: 0 }], 1],
	])("makes both runs and returns the exit code: %s", (_which, results, expected) => {
		const spawn = ending(...results);
		expect(run(spawn)).toBe(expected);
		expect(spawn).toHaveBeenCalledTimes(2);
	});

	it.each([["in the sandbox", SANDBOX], ["elsewhere", {}]])("refuses arguments %s, which could narrow the run", (_where, env) => {
		const spawn = passing();
		expect(run(spawn, env, { args: ["-t", "nothing"] })).not.toBe(0);
		expect(spawn).not.toHaveBeenCalled();
	});

	it.each([
		["a symlink to a folder", () => symlinkSync(outside, path.join(repo, ".cache"))],
		["a dangling symlink", () => symlinkSync(path.join(outside, "missing"), path.join(repo, ".cache"))],
		["a file", () => writeFileSync(path.join(repo, ".cache"), "")],
	])("refuses a .cache that is %s, before any run", (_what, make) => {
		const keep = precious();
		make();
		const spawn = passing();
		expect(run(spawn)).toBe(1);
		expect(spawn).not.toHaveBeenCalled();
		expect(existsSync(keep)).toBe(true);
		expect(existsSync(path.join(outside, "missing"))).toBe(false);
		expect(out.error).toHaveBeenCalledWith(expect.stringContaining("not a real folder"));
	});

	it("does not follow a .cache that becomes a symlink during a run, and keeps that run's exit code", () => {
		const keep = precious();
		let runs = 0;
		const spawn = vi.fn(() => {
			runs += 1;
			if (runs === 1) return { status: 0 };
			rmSync(path.join(repo, ".cache"), { recursive: true });
			symlinkSync(outside, path.join(repo, ".cache"));
			return { status: 7 };
		});
		expect(run(spawn)).toBe(7);
		expect(existsSync(keep)).toBe(true);
		expect(out.error).toHaveBeenCalledWith(expect.stringContaining("not a real folder"));
	});

	it("fails when the tests pass but the temp folder cannot be removed", () => {
		let runs = 0;
		const spawn = vi.fn(() => {
			runs += 1;
			if (runs === 2) {
				rmSync(path.join(repo, ".cache"), { recursive: true });
				symlinkSync(outside, path.join(repo, ".cache"));
			}
			return { status: 0 };
		});
		expect(run(spawn)).toBe(1);
	});

	it("removes a symlink in place of the temp folder without following it", () => {
		const keep = precious();
		mkdirSync(path.join(repo, ".cache"));
		symlinkSync(path.dirname(keep), temp());
		expect(run(passing())).toBe(0);
		expect(existsSync(keep)).toBe(true);
		expect(lstatSync(temp(), { throwIfNoEntry: false })).toBeUndefined();
	});

	it("clears what an earlier killed run left, read-only folders included", () => {
		const locked = path.join(temp(), "locked");
		mkdirSync(locked, { recursive: true });
		writeFileSync(path.join(locked, "file"), "");
		chmodSync(locked, 0o555);
		const spawn = vi.fn(() => {
			expect(existsSync(locked)).toBe(false);
			return { status: 0 };
		});
		expect(run(spawn)).toBe(0);
		expect(spawn).toHaveBeenCalledTimes(2);
		expect(existsSync(temp())).toBe(false);
	});

	it("runs npm's own script on Windows, where npm is not a program", () => {
		const spawn = passing();
		expect(run(spawn, { npm_execpath: "C:\\npm\\bin\\npm-cli.js" }, { platform: "win32" })).toBe(0);
		expect(spawn.mock.calls[0].slice(0, 2)).toEqual([process.execPath, ["C:\\npm\\bin\\npm-cli.js", "--prefix", "frontend", "test"]]);
	});
});
