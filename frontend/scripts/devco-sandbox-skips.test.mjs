// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { NEEDS_WORKTREE_TEMP, SKIPPED_FILES, SKIPPED_TESTS, isCheckSandbox, keepPattern, vitestRuns } from "../../scripts/devco-sandbox-skips.mjs";

const frontendDir = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(frontendDir, file), "utf8");

const DEFINES = new Map([["describe", "suite"], ["suite", "suite"], ["it", "test"], ["test", "test"]]);
const FACTORIES = ["each", "for", "skipIf", "runIf"];

// "suite" or "test" if a call with this callee defines one: it(…), it.only(…), it.each(rows)(…).
function definition(callee) {
	// it.each(rows) itself only returns the function that takes the title.
	if (ts.isPropertyAccessExpression(callee) && FACTORIES.includes(callee.name.text)) return undefined;
	let head = callee;
	while (ts.isCallExpression(head) || ts.isPropertyAccessExpression(head) || ts.isTaggedTemplateExpression(head)) {
		head = ts.isTaggedTemplateExpression(head) ? head.tag : head.expression;
	}
	return ts.isIdentifier(head) ? DEFINES.get(head.text) : undefined;
}

function callsIn(node, calls = new Set()) {
	if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
		calls.add((ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression).getText());
	}
	ts.forEachChild(node, (child) => void callsIn(child, calls));
	return calls;
}

// Every test a file defines, read from its source: the titles of its suites, its full title as
// vitest matches it, and the functions its body calls.
function testsIn(file) {
	const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
	const tests = [];
	const visit = (node, suites) => {
		const kind = ts.isCallExpression(node) ? definition(node.expression) : undefined;
		if (!kind) {
			ts.forEachChild(node, (child) => visit(child, suites));
			return;
		}
		const [title] = node.arguments;
		if (!title || !ts.isStringLiteralLike(title)) throw new Error(`${file}: the guard cannot read the title in ${node.getText().slice(0, 80)}`);
		if (kind === "test") {
			tests.push({ suites, name: [...suites, title.text].join(" "), calls: callsIn(node) });
			return;
		}
		ts.forEachChild(node, (child) => visit(child, [...suites, title.text]));
	};
	visit(source, []);
	return tests;
}

const names = (tests) => tests.map(({ name }) => name);
const listedIn = ({ file, suites = [], tests = [] }) => {
	const titles = tests.map((title) => title.replaceAll(" > ", " "));
	return testsIn(file).filter((test) => titles.includes(test.name) || suites.includes(test.suites[0]));
};

// The lists apply only in DevCo's check sandbox, so a stale entry would not show up in a CI run.
describe("DevCo sandbox skips", () => {
	it("leaves nothing out unless CEZ_CHECK_SANDBOX is 1", () => {
		for (const env of [{}, { CEZ_CHECK_SANDBOX: "" }, { CEZ_CHECK_SANDBOX: "0" }]) {
			expect(vitestRuns(env)).toEqual([{ args: [], worktreeTemp: false }]);
		}
	});

	it("ignores the flag under GitHub Actions, which runs the listed tests", () => {
		expect(isCheckSandbox({ CEZ_CHECK_SANDBOX: "1" })).toBe(true);
		const env = { CEZ_CHECK_SANDBOX: "1", GITHUB_ACTIONS: "true" };
		expect(isCheckSandbox(env)).toBe(false);
		expect(vitestRuns(env)).toEqual([{ args: [], worktreeTemp: false }]);
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
		expect(["server", "other"]).toContain(kind);
		expect(reason).not.toBe("");
	});

	it.each(NEEDS_WORKTREE_TEMP)("%s still makes executable files in the temp folder", (file) => {
		expect(read(file)).toMatch(/\btmpdir\(\)/);
		expect(read(file)).toMatch(/\b0o755\b/);
	});

	it.each(SKIPPED_FILES)("$file has no test that could run: each one calls $starts", ({ file, kind, starts }) => {
		expect(kind).toBe("server");
		const tests = testsIn(file);
		expect(tests).not.toEqual([]);
		expect(names(tests.filter(({ calls }) => !calls.has(starts)))).toEqual([]);
	});

	it.each(SKIPPED_TESTS.filter(({ kind }) => kind === "server"))("$file skips exactly the tests that call $starts", (entry) => {
		const starting = testsIn(entry.file).filter(({ calls }) => calls.has(entry.starts));
		expect(starting).not.toEqual([]);
		expect(names(listedIn(entry))).toEqual(names(starting));
	});

	it("drops the listed tests and no others, by the real titles of every file in the filtered run", () => {
		const keep = new RegExp(keepPattern());
		const separate = [...SKIPPED_TESTS.map(({ file }) => file), ...NEEDS_WORKTREE_TEMP];
		const tests = separate.flatMap((file) => testsIn(file).map((test) => ({ ...test, file })));
		const dropped = tests.filter(({ name }) => !keep.test(name)).map(({ file, name }) => `${file}: ${name}`);
		const listed = SKIPPED_TESTS.flatMap((entry) => names(listedIn(entry)).map((name) => `${entry.file}: ${name}`));
		expect(dropped).toEqual(listed);
		// Each listed title and suite is a real one, so none is listed in vain.
		for (const { file, suites = [], tests: titles = [] } of SKIPPED_TESTS) {
			const real = testsIn(file);
			for (const title of titles) expect(names(real), file).toContain(title.replaceAll(" > ", " "));
			for (const suite of suites) expect(real.map((test) => test.suites[0]), file).toContain(suite);
		}
		// A title with placeholders stands for many, and none of them may be a listed one.
		const titles = SKIPPED_TESTS.flatMap(({ tests: named = [] }) => named.map((title) => title.replaceAll(" > ", " ")));
		for (const { name } of tests.filter((test) => /[%$]/.test(test.name))) {
			const literal = name.split(/%[a-zA-Z#]|\$[\w.]+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
			expect(titles.filter((title) => new RegExp(`^${literal.join(".*")}$`).test(title)), name).toEqual([]);
		}
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
