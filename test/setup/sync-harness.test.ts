import { afterEach, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkpoint, scan, type Config, type Report, type Review } from "../../skills/ah-sync-harness/scripts/sync-harness";
import { writeSkillDirectory } from "../../src/setup/skills";
import { manifestFor } from "../../src/setup/manifest";

const root = path.resolve(import.meta.dir, "../..");
const temporary: string[] = [];
afterEach(async () => { for (const dir of temporary.splice(0)) await rm(dir, { recursive: true, force: true }); });
async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sync-harness-"));
  temporary.push(dir);
  const upstream = path.join(dir, "upstream");
  const destination = path.join(dir, "distribution");
  await mkdir(upstream); await mkdir(destination);
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(["git", "-C", upstream, ...args], { stdout: "pipe", stderr: "pipe" });
    if (result.exitCode) throw new Error(Buffer.from(result.stderr).toString());
  };
  git("init", "-q"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
  await Bun.write(path.join(upstream, ".gitignore"), "ignored/\n");
  await Bun.write(path.join(upstream, "skills/a.md"), "first");
  await Bun.write(path.join(upstream, "skills/b.md"), "second");
  git("add", "."); git("commit", "-qm", "initial");
  const config: Config = { version: 1, destination, sources: [{ id: "personal", root: upstream, include: ["skills"], exclude: [], mappings: [{ from: "skills", to: "skills" }] }] };
  const configFile = path.join(dir, "config.json");
  const saveConfig = () => Bun.write(configFile, JSON.stringify(config));
  await saveConfig();
  return { dir, upstream, destination, config, configFile, saveConfig, git, state: () => readFile(path.join(dir, "state.json"), "utf8") };
}
function decisions(report: Report, outcome: "ported" | "excluded" | "pending" = "excluded"): Review {
  return { items: report.items.map(i => ({ source: i.source, path: i.path,
    classification: outcome === "ported" ? "adapt" : outcome === "pending" ? "unresolved" : "personal", outcome,
    reason: "Fixture review", destinations: outcome === "ported" ? ["skills/result.md"] : [] })), verification: [] };
}

test("first scan is read-only; discovers untracked, staged and deleted content, ignores excluded content", async () => {
  const f = await fixture();
  await Bun.write(path.join(f.upstream, "skills/untracked.md"), "new");
  await Bun.write(path.join(f.upstream, "skills/a.md"), "staged"); f.git("add", "skills/a.md");
  await rm(path.join(f.upstream, "skills/b.md"));
  await Bun.write(path.join(f.upstream, "ignored/secret"), "not inventoried");
  f.config.sources[0].exclude.push({ path: "skills/untracked.md", reason: "Out of scope" }); await f.saveConfig();
  const report = await scan(f.configFile);
  expect(report.items.map(i => [i.path, i.change])).toEqual([["skills/a.md", "unreviewed"], ["skills/b.md", "unreviewed"]]);
  expect(report.items[1].hash).toBeNull();
  expect(report.sources[0].dirty).toBe(true);
  expect(report.exclusions[0].reason).toBe("Out of scope");
  expect(await Bun.file(path.join(f.dir, "state.json")).exists()).toBe(false);
});

test("partial decisions keep unseen files; exact dirty content is checkpointed and later edits reopen it", async () => {
  const f = await fixture();
  await Bun.write(path.join(f.upstream, "skills/a.md"), "dirty reviewed");
  const report = await scan(f.configFile);
  const review = decisions(report); review.items.pop();
  await checkpoint(f.configFile, report, review);
  const state = JSON.parse(await f.state());
  expect(Object.values(state.records)).toHaveLength(1);
  expect(Object.values(state.records)[0]).toMatchObject({ hash: report.items[0].hash, revision: report.items[0].revision, dirty: true });
  expect((await scan(f.configFile)).items.map(i => i.path)).toEqual(["skills/b.md"]);
  await Bun.write(path.join(f.upstream, "skills/a.md"), "dirty revised");
  expect((await scan(f.configFile)).items[0].change).toBe("changed");
});

test("pending items survive unchanged content, exclusions and removed sources", async () => {
  const f = await fixture(); const report = await scan(f.configFile);
  await checkpoint(f.configFile, report, decisions(report, "pending"));
  let next = await scan(f.configFile);
  expect(next.items.every(i => i.change === "pending")).toBe(true);
  f.config.sources[0].exclude = [{ path: "skills", reason: "Changed scope" }]; await f.saveConfig();
  next = await scan(f.configFile);
  expect(next.items.every(i => !i.scoped && i.pendingReason === "Fixture review")).toBe(true);
  await expect(checkpoint(f.configFile, next, decisions(next))).rejects.toThrow("restore");
  f.config.sources[0].id = "replacement"; await f.saveConfig();
  expect((await scan(f.configFile)).items.filter(i => i.source === "personal")).toHaveLength(2);
});

test("deletions and executable changes reopen reviewed files; resolved deletions do not recur", async () => {
  const f = await fixture(); const report = await scan(f.configFile);
  await checkpoint(f.configFile, report, decisions(report));
  await rm(path.join(f.upstream, "skills/a.md"));
  await chmod(path.join(f.upstream, "skills/b.md"), 0o755);
  const next = await scan(f.configFile);
  expect(next.items.map(i => i.change)).toEqual(["deleted", "changed"]);
  await checkpoint(f.configFile, next, decisions(next));
  expect((await scan(f.configFile)).items).toEqual([]);
});

test("mapping changes reopen content, and destination changes cannot reuse another distribution's checkpoint", async () => {
  const f = await fixture(); const report = await scan(f.configFile);
  await checkpoint(f.configFile, report, decisions(report));
  f.config.sources[0].mappings[0].to = "other-skills"; await f.saveConfig();
  expect((await scan(f.configFile)).items.every(i => i.change === "mapping")).toBe(true);
  f.config.destination = f.upstream; await f.saveConfig();
  await expect(scan(f.configFile)).rejects.toThrow("Destination changed");
});

test("stale reports, duplicate decisions and failed checks never advance state", async () => {
  const f = await fixture(); let report = await scan(f.configFile);
  await checkpoint(f.configFile, report, decisions(report, "pending"));
  const state = await f.state();
  await expect(checkpoint(f.configFile, report, decisions(report))).rejects.toThrow("Stale report");
  report = await scan(f.configFile);
  const review = decisions(report, "ported");
  await expect(checkpoint(f.configFile, report, review)).rejects.toThrow("fresh-install and upgrade");
  review.verification = [
    { label: "fresh-install", command: [process.execPath, "-e", "process.exit(1)"], cwd: "." },
    { label: "upgrade", command: [process.execPath, "-e", "process.exit(0)"], cwd: "." },
  ];
  await expect(checkpoint(f.configFile, report, review)).rejects.toThrow("Verification failed");
  expect(await f.state()).toBe(state);
  const duplicate = decisions(report); duplicate.items.push(duplicate.items[0]);
  await expect(checkpoint(f.configFile, report, duplicate)).rejects.toThrow("duplicate");
  await Bun.write(path.join(f.upstream, "skills/a.md"), "changed while reviewing");
  await expect(checkpoint(f.configFile, report, decisions(report))).rejects.toThrow("Stale report");
  expect(await f.state()).toBe(state);
});

test("source changes during checks prevent checkpointing, and locks prevent concurrent writers", async () => {
  const f = await fixture(); const report = await scan(f.configFile);
  const review = decisions(report, "ported");
  review.verification = [
    { label: "fresh-install", command: [process.execPath, "-e", "await Bun.write('skills/a.md', 'changed')"], cwd: f.upstream },
    { label: "upgrade", command: [process.execPath, "-e", "process.exit(0)"], cwd: "." },
  ];
  await expect(checkpoint(f.configFile, report, review)).rejects.toThrow("during verification");
  expect(await Bun.file(path.join(f.dir, "state.json")).exists()).toBe(false);
  await mkdir(path.join(f.dir, "state.json.lock"));
  const next = await scan(f.configFile);
  await expect(checkpoint(f.configFile, next, decisions(next))).rejects.toThrow();
  await expect((await import("node:fs/promises")).stat(path.join(f.dir, "state.json.lock"))).resolves.toBeDefined();
});

test("source symlinks are hashed without following targets and parent symlinks fail closed", async () => {
  const f = await fixture();
  await symlink("/missing-private-file", path.join(f.upstream, "skills/link"));
  const report = await scan(f.configFile);
  expect(report.items.find(i => i.path === "skills/link")?.hash).toBeString();
  await rm(path.join(f.upstream, "skills"), { recursive: true });
  await symlink(f.destination, path.join(f.upstream, "skills"));
  await expect(scan(f.configFile)).rejects.toThrow("parent is a symlink");
});

test("unborn repositories keep null revision; malformed state and traversal are rejected", async () => {
  const f = await fixture();
  await rm(path.join(f.upstream, ".git"), { recursive: true }); f.git("init", "-q");
  expect((await scan(f.configFile)).sources[0].revision).toBeNull();
  f.config.sources[0].include = ["../outside"]; await f.saveConfig();
  await expect(scan(f.configFile)).rejects.toThrow("traversal");
  f.config.sources[0].include = ["skills"]; await f.saveConfig();
  await Bun.write(path.join(f.dir, "state.json"), "broken");
  await expect(scan(f.configFile)).rejects.toThrow();
  await Bun.write(path.join(f.dir, "state.json"), JSON.stringify({ version: 1, records: { partial: {} } }));
  await expect(scan(f.configFile)).rejects.toThrow("Invalid checkpoint record");
});

test("installed helper executes outside the checkout and successful checks permit only selected checkpoints", async () => {
  const f = await fixture();
  const installed = path.join(f.dir, "consumer/.agents/skills/sync-harness");
  await writeSkillDirectory(path.join(root, "skills/ah-sync-harness"), installed, {});
  expect(await manifestFor(installed)).toEqual(await manifestFor(path.join(root, "dist/skills/sync-harness")));
  const helper = path.join(installed, "scripts/sync-harness.ts");
  const child = Bun.spawnSync([process.execPath, helper, "scan", f.configFile], { cwd: f.dir, stdout: "pipe", stderr: "pipe" });
  expect(child.exitCode).toBe(0);
  const report = JSON.parse(Buffer.from(child.stdout).toString()) as Report;
  const review = decisions(report, "ported"); review.items.pop();
  // Fixture assertions prove verification actually runs. Installer behavior has its own test below.
  await Bun.write(path.join(f.destination, "skills/result.md"), "adapted fixture");
  review.verification = ["fresh-install", "upgrade"].map(label => ({ label, command: [process.execPath, "-e", "if (await Bun.file('skills/result.md').text() !== 'adapted fixture') process.exit(1)"], cwd: "." }));
  await checkpoint(f.configFile, report, review);
  expect((await scan(f.configFile)).items.map(i => i.path)).toEqual(["skills/b.md"]);
  expect(JSON.parse(await f.state()).verification).toMatch(/^verification-/);
});

test("legacy setup fresh install and upgrade deliver the full sync skill and preserve unrelated consumer files", async () => {
  const f = await fixture();
  const target = path.join(f.dir, "consumer"); await mkdir(target);
  await Bun.write(path.join(target, "keep.txt"), "consumer-owned");
  const install = () => {
    const result = Bun.spawnSync([process.execPath, path.join(root, "bin/setup"), "--yes", "--overwrite"], { cwd: target, stdout: "pipe", stderr: "pipe" });
    expect(Buffer.from(result.stderr).toString()).toBe("");
    expect(result.exitCode).toBe(0);
  };
  install();
  const skill = path.join(target, ".agents/skills/sync-harness");
  expect(await manifestFor(skill)).toEqual(await manifestFor(path.join(root, "dist/skills/sync-harness")));
  // Simulate an older managed skill with an obsolete resource and prior content.
  await Bun.write(path.join(skill, "SKILL.md"), "old skill");
  await Bun.write(path.join(skill, "scripts/retired.ts"), "retired");
  const metadataFile = path.join(target, ".agents/agent-harness-install.json");
  const metadata = await Bun.file(metadataFile).json();
  metadata.skills["sync-harness"].installedFiles = await manifestFor(skill);
  await Bun.write(metadataFile, JSON.stringify(metadata));
  install();
  expect(await manifestFor(skill)).toEqual(await manifestFor(path.join(root, "dist/skills/sync-harness")));
  expect(await Bun.file(path.join(target, "keep.txt")).text()).toBe("consumer-owned");
  expect(await Bun.file(path.join(target, ".agent-harness/sync-harness/state.json")).exists()).toBe(false);
});
