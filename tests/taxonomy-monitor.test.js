import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const directories = [];
const baselineVersion = JSON.parse(readFileSync("data/taxonomy-version.json", "utf8")).ebirdVersion;
function runMonitor(version, issues, publish = true) {
  const directory = mkdtempSync(join(tmpdir(), "ebird-monitor-test-"));
  directories.push(directory);
  const mockPath = join(directory, "mock.mjs");
  writeFileSync(mockPath, `
    import childProcess from "node:child_process";
    import { syncBuiltinESMExports } from "node:module";
    globalThis.fetch = async () => ({ ok: true, json: async () => [{ latest: true, authorityVer: ${version} }] });
    childProcess.execFileSync = (command, args) => {
      if (command !== "gh") throw new Error("Unexpected command");
      if (args[1] === "list") {
        if (!args.includes("all")) throw new Error("Must check closed issues too");
        return ${JSON.stringify(JSON.stringify(issues))};
      }
      if (args[1] === "create") return "mock-created-issue";
      throw new Error("Unexpected GitHub mutation");
    };
    syncBuiltinESMExports();
  `);
  return execFileSync(process.execPath, ["--import", pathToFileURL(mockPath).href, resolve("scripts/check-taxonomy-update.mjs"), ...publish ? ["--issue"] : []], { encoding: "utf8", env: { ...process.env, GITHUB_REPOSITORY: "test/repository" } });
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe("annual taxonomy notification", () => {
  it("stays quiet on the current version", () => {
    expect(runMonitor(baselineVersion, [])).toContain("unchanged");
  });
  it("reports a new version without publishing in read-only mode", () => {
    const output = runMonitor(2100, [], false);
    expect(output).toContain(`${baselineVersion} → 2100`);
    expect(output).not.toContain("mock-created-issue");
  });
  it("opens an issue for a new untracked version", () => {
    expect(runMonitor(2100, [])).toContain("mock-created-issue");
  });
  it("deduplicates against both open and closed marked issues", () => {
    const output = runMonitor(2100, [{ body: "<!-- ebird-taxonomy-version:2100 -->", url: "mock-existing" }]);
    expect(output).toContain("already has a review issue");
    expect(output).not.toContain("mock-created-issue");
  });
  it("does not mistake a different version for the current one", () => {
    expect(runMonitor(2100, [{ body: "<!-- ebird-taxonomy-version:2099 -->" }])).toContain("mock-created-issue");
  });
});
