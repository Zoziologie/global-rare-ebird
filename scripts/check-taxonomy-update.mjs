import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Read the reviewed baseline and upstream versions --------------------------
const baseline = JSON.parse(await readFile(fileURLToPath(new URL("../data/taxonomy-version.json", import.meta.url)), "utf8"));
const response = await fetch("https://api.ebird.org/v2/ref/taxonomy/versions", { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`eBird version check failed: HTTP ${response.status}`);
const versions = await response.json();
const latest = versions.find((entry) => entry.latest)?.authorityVer;
if (typeof latest !== "number") throw new Error("eBird did not return a latest taxonomy version");
if (latest === baseline.ebirdVersion) {
  console.log(`eBird taxonomy ${latest}: unchanged.`);
  process.exit(0);
}
if (latest < baseline.ebirdVersion) throw new Error(`Upstream latest version ${latest} is older than the reviewed baseline`);

// Report once per version; never change taxonomy files or merge a PR --------
const title = `Review eBird taxonomy ${latest} update`;
const marker = `<!-- ebird-taxonomy-version:${latest} -->`;
console.log(`New eBird taxonomy: ${baseline.ebirdVersion} → ${latest}`);
if (!process.argv.includes("--issue")) process.exit(0);
const repository = process.env.GITHUB_REPOSITORY;
if (!repository) throw new Error("Set GITHUB_REPOSITORY to the owner/repository when using --issue");
const issues = JSON.parse(execFileSync("gh", ["issue", "list", "--repo", repository, "--state", "all", "--search", `in:title "${title}"`, "--limit", "100", "--json", "url,body"], { encoding: "utf8" }));
if (issues.some((issue) => issue.body.includes(marker))) {
  console.log("This taxonomy version already has a review issue.");
  process.exit(0);
}
const body = `${marker}
The eBird version endpoint reports **${latest}** as latest. Our recorded baseline is **${baseline.ebirdVersion}**.

Follow the linear taxonomy workflow introduced in #39 and documented in docs/taxonomy-review.md.

- [ ] Capture matching-version API and official concept-bearing checklist snapshots with checksums.
- [ ] Build the Avibase ID ↔ eBird code crosswalk and compare it with the retained baseline.
- [ ] Review changed/missing concepts, splits/lumps, category/reportability changes, and coverage gaps.
- [ ] Resolve accepted regional concepts without broadening subspecies scope or silently choosing an ambiguous code.
- [ ] Generate the matching reports and compact application lookups in a draft PR.
- [ ] Update the recorded baseline only after the new taxonomy/mappings are reviewed.

No application data was changed. The Action does not auto-merge or publish a release. Regional source acquisition and biological review may require manual work.

Sources: [eBird versions](https://api.ebird.org/v2/ref/taxonomy/versions), [Cornell downloads](https://www.birds.cornell.edu/clementschecklist/download/).
`;
const bodyPath = join(tmpdir(), `global-rare-ebird-taxonomy-${latest}.md`);
await writeFile(bodyPath, body);
console.log(execFileSync("gh", ["issue", "create", "--repo", repository, "--title", title, "--body-file", bodyPath], { encoding: "utf8" }).trim());
