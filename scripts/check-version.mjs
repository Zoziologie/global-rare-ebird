import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const changelog = readFileSync("CHANGELOG.md", "utf8");

assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "Use a stable semantic version: X.Y.Z");
assert.equal(lock.version, pkg.version, "package-lock.json version differs from package.json");
assert.equal(lock.packages[""].version, pkg.version, "Lockfile root package version differs from package.json");

const lines = changelog.split("\n");
const start = lines.findIndex(line => line.startsWith(`## [${pkg.version}] - `));
assert.ok(start >= 0, `CHANGELOG.md is missing version ${pkg.version}`);
assert.match(lines[start].slice(`## [${pkg.version}] - `.length), /^\d{4}-\d{2}-\d{2}$/, "Date the changelog entry as YYYY-MM-DD");
const next = lines.findIndex((line, index) => index > start && line.startsWith("## ["));
const notes = lines.slice(start + 1, next === -1 ? undefined : next).join("\n").trim();
assert.ok(notes.length > 0, "Version notes must describe the changes");

if (process.env.VERSION_BASE_REF) {
  const base = JSON.parse(execFileSync("git", ["show", `${process.env.VERSION_BASE_REF}:package.json`], { encoding: "utf8" })).version.split(".").map(Number);
  const current = pkg.version.split(".").map(Number);
  const different = current.findIndex((part, index) => part !== base[index]);
  assert.ok(different === -1 || current[different] > base[different], "Package version must not go backwards");
}

console.log(`Version metadata valid: ${pkg.version}`);
