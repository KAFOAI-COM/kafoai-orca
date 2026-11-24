// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RUNS_TEMP_SCRIPTS, SKIPPED_FILES, SKIPPED_TESTS, keepPattern, vitestRuns } from "../../scripts/devco-sandbox-skips.mjs";

const frontendDir = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(frontendDir, file), "utf8");

// The lists apply only in DevCo's check sandbox, so a stale entry would not show up in a CI run.
describe("DevCo sandbox skips", () => {
	it("leaves nothing out unless CEZ_CHECK_SANDBOX is 1", () => {
		for (const env of [{}, { CEZ_CHECK_SANDBOX: "" }, { CEZ_CHECK_SANDBOX: "0" }]) {
			expect(vitestRuns(env)).toEqual([{ args: [], worktreeTemp: false }]);
		}
	});

	it("runs every file that is not skipped whole", () => {
		const [rest, separate] = vitestRuns({ CEZ_CHECK_SANDBOX: "1" });
		const excluded = rest.args.filter((arg) => arg !== "--exclude");
		const whole = SKIPPED_FILES.map(({ file }) => file);
		expect(excluded.filter((file) => !whole.includes(file))).toEqual(separate.args.slice(0, separate.args.indexOf("-t")));
		expect(new Set(excluded).size).toBe(excluded.length);
	});

	it.each([...SKIPPED_FILES, ...SKIPPED_TESTS].map(({ file, kind, reason }) => [file, kind, reason]))("%s exists and says why", (file, kind, reason) => {
		expect(read(file)).not.toBe("");
		expect(["server", "binary", "other"]).toContain(kind);
		expect(reason).not.toBe("");
	});

	it.each(RUNS_TEMP_SCRIPTS)("%s exists", (file) => {
		expect(read(file)).not.toBe("");
	});

	it.each(SKIPPED_TESTS.flatMap(({ file, suites = [], tests = [] }) => [
		...suites.map((suite) => [file, suite, `describe("${suite}"`]),
		...tests.flatMap((title) => {
			const [test, ...suites] = title.split(" > ").reverse();
			return [[file, title, `("${test}"`], ...suites.map((suite) => [file, title, `describe("${suite}"`])];
		}),
	]))("%s still has exactly one %s", (file, _title, source) => {
		expect(read(file).split(source)).toHaveLength(2);
	});

	it("filters out the named tests and no others", () => {
		const keep = new RegExp(keepPattern());
		const runs = (name) => keep.test(name);
		for (const { suites = [], tests = [] } of SKIPPED_TESTS) {
			for (const suite of suites) expect(runs(`${suite} some test`), suite).toBe(false);
			for (const title of tests) {
				expect(runs(title.replaceAll(" > ", " ")), title).toBe(false);
				expect(runs(`${title.replaceAll(" > ", " ")} too`), title).toBe(true);
			}
		}
		expect(runs("cloud agent proxy reads Retry-After within bounds")).toBe(true);
		expect(runs("isLocalAddress treats 127.0.0.1 as local")).toBe(true);
		expect(runs("resolveDaemonFromPort probes exactly the expected port")).toBe(true);
	});
});
