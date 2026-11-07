import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readlink, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type Mapping = { from: string; to: string };
type Source = { id: string; root: string; include: string[]; exclude: { path: string; reason: string }[]; mappings: Mapping[] };
export type Config = { version: 1; destination: string; sources: Source[] };
type RecordEntry = {
  source: string; path: string; root: string; hash: string | null; revision: string | null;
  dirty: boolean; mapping: string | null; classification: string; outcome: string;
  reason: string; destinations: string[];
};
type State = { version: 1; destination?: string; records: Record<string, RecordEntry>; verification?: string };
export type Item = {
  source: string; path: string; hash: string | null; previousHash: string | null;
  revision: string | null; dirty: boolean; mapping: string | null; scoped: boolean;
  change: "unreviewed" | "added" | "changed" | "deleted" | "pending" | "mapping";
  pendingReason?: string;
};
export type Report = {
  version: 1; configHash: string; stateHash: string; items: Item[];
  sources: { id: string; root: string; revision: string | null; dirty: boolean }[];
  exclusions: { source: string; path: string; reason: string }[];
};
export type Review = {
  items: { source: string; path: string; classification: "as-is" | "adapt" | "personal" | "unresolved";
    outcome: "ported" | "excluded" | "pending"; reason: string; destinations: string[] }[];
  verification: { label: string; command: string[]; cwd: string }[];
};
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const key = (source: string, file: string) => JSON.stringify([source, file]);
const inside = (file: string, prefix: string) => prefix === "." || file === prefix || file.startsWith(`${prefix}/`);
function relative(value: string): string {
  if (typeof value !== "string" || !value || path.isAbsolute(value) || value.includes("\\") || value.includes("\0") || value.split("/").some(p => p === ".." || p === "")) {
    throw new Error(`Expected a relative path without traversal: ${value}`);
  }
  return value;
}
function git(root: string, args: string[], allowFailure = false): string {
  const result = Bun.spawnSync(["git", "-C", root, ...args], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0 && !allowFailure) throw new Error(`Git failed: ${Buffer.from(result.stderr).toString().trim()}`);
  return result.exitCode === 0 ? Buffer.from(result.stdout).toString() : "";
}
async function optionalText(file: string): Promise<string> {
  try { return await readFile(file, "utf8"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}
async function load(configFile: string) {
  const raw = await readFile(configFile, "utf8");
  const config = JSON.parse(raw) as Config;
  if (config.version !== 1 || !Array.isArray(config.sources) || !config.sources.length) throw new Error("Invalid config version or sources");
  const base = path.dirname(path.resolve(configFile));
  config.destination = await realpath(path.resolve(base, config.destination));
  const ids = new Set<string>();
  for (const source of config.sources) {
    if (!/^[a-z0-9-]+$/.test(source.id) || ids.has(source.id)) throw new Error("Source IDs must be unique lowercase names");
    ids.add(source.id);
    source.root = await realpath(path.resolve(base, source.root));
    if (await realpath(git(source.root, ["rev-parse", "--show-toplevel"]).trim()) !== source.root) throw new Error("Source root must be a Git worktree root");
    if (!source.include?.length || !Array.isArray(source.exclude) || !Array.isArray(source.mappings)) throw new Error("Each source needs include, exclude, and mappings arrays");
    source.include.forEach(relative);
    for (const exclusion of source.exclude) {
      relative(exclusion.path);
      if (!exclusion.reason?.trim()) throw new Error("Exclusions need reasons");
    }
    for (const mapping of source.mappings) { relative(mapping.from); relative(mapping.to); }
  }
  const stateFile = path.join(base, "state.json");
  if (path.resolve(configFile) === stateFile) throw new Error("Config must not be named state.json");
  const stateRaw = await optionalText(stateFile);
  const state: State = stateRaw ? JSON.parse(stateRaw) : { version: 1, records: {} };
  if (state.version !== 1 || !state.records || typeof state.records !== "object" || Array.isArray(state.records)) throw new Error("Invalid state; restore a known checkpoint, do not reset it silently");
  for (const [id, record] of Object.entries(state.records)) {
    if (!record || typeof record.source !== "string" || typeof record.path !== "string" ||
        id !== key(record.source, record.path) || typeof record.root !== "string" || !path.isAbsolute(record.root) ||
        !(record.hash === null || (typeof record.hash === "string" && /^[a-f0-9]{64}$/.test(record.hash))) ||
        !(record.revision === null || typeof record.revision === "string") || typeof record.dirty !== "boolean" ||
        !(record.mapping === null || typeof record.mapping === "string") || !record.reason?.trim() ||
        !["ported", "excluded", "pending"].includes(record.outcome) ||
        !["as-is", "adapt", "personal", "unresolved"].includes(record.classification) || !Array.isArray(record.destinations)) {
      throw new Error("Invalid checkpoint record; restore a known checkpoint, do not reset it silently");
    }
    relative(record.path);
    record.destinations.forEach(relative);
  }
  if (state.destination && state.destination !== config.destination) throw new Error("Destination changed; use a separate config/state directory for another distribution");
  return { config, configHash: hash(JSON.stringify(config)), stateFile, state, stateHash: hash(stateRaw) };
}
function mappingFor(source: Source, file: string): string | null {
  const mapping = source.mappings.filter(m => inside(file, m.from)).sort((a, b) => b.from.length - a.from.length)[0];
  return mapping ? mapping.to : null;
}
// Read file content only inside the configured worktree. Never follow a source symlink.
async function fingerprint(root: string, file: string): Promise<string | null> {
  relative(file);
  const parts = file.split("/");
  for (let index = 1; index <= parts.length; index++) {
    const full = path.join(root, ...parts.slice(0, index));
    let stat;
    try { stat = await lstat(full); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "ENOTDIR") return null;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      if (index !== parts.length) throw new Error(`Source parent is a symlink: ${file}`);
      return hash(`symlink:${await readlink(full)}`);
    }
    if (index === parts.length) {
      if (!stat.isFile()) throw new Error(`Unsupported source entry (directories/submodules need separate sources): ${file}`);
      return hash(Buffer.concat([Buffer.from(`${stat.mode & 0o111}:`), await readFile(full)]));
    }
  }
  return null;
}
export async function scan(configFile: string): Promise<Report> {
  const loaded = await load(configFile);
  const { config, state } = loaded;
  const report: Report = { version: 1, configHash: loaded.configHash, stateHash: loaded.stateHash, items: [], sources: [], exclusions: [] };
  for (const source of config.sources) {
    const revision = git(source.root, ["rev-parse", "--verify", "HEAD"], true).trim() || null;
    const dirty = git(source.root, ["status", "--porcelain", "--untracked-files=normal"]).length > 0;
    report.sources.push({ id: source.id, root: source.root, revision, dirty });
    report.exclusions.push(...source.exclude.map(e => ({ source: source.id, ...e })));
    const tracked = git(source.root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean);
    const previous = Object.values(state.records).filter(r => r.source === source.id);
    if (previous.some(r => r.root !== source.root)) throw new Error(`Source root changed for ${source.id}; use a new source ID and retain old records`);
    const files = [...new Set([...tracked, ...previous.map(r => r.path)])].sort();
    for (const file of files) {
      const old = state.records[key(source.id, file)];
      const scoped = source.include.some(p => inside(file, p)) && !source.exclude.some(e => inside(file, e.path));
      if (!scoped && old?.outcome !== "pending") continue;
      const currentHash = scoped ? await fingerprint(source.root, file) : null;
      const mapping = mappingFor(source, file);
      if (old && old.outcome !== "pending" && old.hash === currentHash && old.mapping === mapping) continue;
      // A tracked deletion before the first review is still a review candidate.
      const change = old?.outcome === "pending" ? "pending" : !old ? "unreviewed" : old.mapping !== mapping ? "mapping" : currentHash === null ? "deleted" : old.hash === null ? "added" : "changed";
      report.items.push({ source: source.id, path: file, hash: currentHash, previousHash: old?.hash ?? null, revision, dirty, mapping, scoped, change, ...(old?.outcome === "pending" ? { pendingReason: old.reason } : {}) });
    }
  }
  for (const old of Object.values(state.records)) {
    if (old.outcome === "pending" && !config.sources.some(s => s.id === old.source)) {
      report.items.push({ source: old.source, path: old.path, hash: null, previousHash: old.hash, revision: null, dirty: false, mapping: old.mapping, scoped: false, change: "pending", pendingReason: old.reason });
    }
  }
  return report;
}

/** Review decisions are explicit; the helper never copies or generalizes source content. */
export async function checkpoint(configFile: string, report: Report, review: Review): Promise<void> {
  const loaded = await load(configFile);
  const current = await scan(configFile);
  if (JSON.stringify(current) !== JSON.stringify(report)) throw new Error("Stale report: scan again; config, state, or source content changed");
  if (!Array.isArray(review.items) || !Array.isArray(review.verification)) throw new Error("Review needs items and verification arrays");
  const seen = new Set<string>();
  for (const decision of review.items) {
    const id = key(decision.source, decision.path);
    const item = report.items.find(i => key(i.source, i.path) === id);
    if (!item || seen.has(id)) throw new Error("Review contains an unknown or duplicate item");
    seen.add(id);
    if (!item.scoped) throw new Error("Pending item left the configured scope; restore its source/scope before resolving it");
    if (!decision.reason?.trim() || !Array.isArray(decision.destinations)) throw new Error("Every decision needs a reason and destinations array");
    const allowed = { ported: ["as-is", "adapt"], excluded: ["personal"], pending: ["as-is", "adapt", "personal", "unresolved"] };
    if (!allowed[decision.outcome]?.includes(decision.classification)) throw new Error("Inconsistent classification and outcome");
    if (decision.outcome === "ported" && !decision.destinations.length) throw new Error("Ported items need destination paths");
    decision.destinations.forEach(relative);
  }
  const ported = review.items.some(i => i.outcome === "ported");
  if (ported && (!review.verification.some(v => v.label === "fresh-install") || !review.verification.some(v => v.label === "upgrade"))) {
    throw new Error("Ported items require fresh-install and upgrade verification commands");
  }
  for (const check of review.verification) {
    if (!check.label?.trim() || !Array.isArray(check.command) || !check.command.length || check.command.some(a => typeof a !== "string") || !check.cwd) throw new Error("Verification needs label, argv command, and cwd");
  }
  // Lock only checkpoint writers; scanning remains read-only. Never remove another writer's lock.
  const lock = `${loaded.stateFile}.lock`;
  await mkdir(lock);
  const evidence = path.join(path.dirname(loaded.stateFile), `verification-${randomUUID()}.log`);
  const temporary = `${loaded.stateFile}.${randomUUID()}.tmp`;
  try {
    let output = "";
    for (const check of review.verification) {
      const cwd = path.resolve(loaded.config.destination, check.cwd);
      const child = Bun.spawn(check.command, { cwd, stdout: "pipe", stderr: "pipe" });
      const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      output += `${JSON.stringify({ label: check.label, command: check.command, cwd, exitCode })}\n${stdout}\n${stderr}\n`;
      await writeFile(evidence, output, { mode: 0o600 });
      if (exitCode !== 0) throw new Error(`Verification failed: ${check.label}; state unchanged; see ${evidence}`);
    }
    if (JSON.stringify(await scan(configFile)) !== JSON.stringify(report)) throw new Error("Sources or state changed during verification; scan again");
    for (const decision of review.items) {
      const item = report.items.find(i => i.source === decision.source && i.path === decision.path)!;
      const source = loaded.config.sources.find(s => s.id === item.source)!;
      loaded.state.records[key(item.source, item.path)] = { ...decision, root: source.root, hash: item.hash, revision: item.revision, dirty: item.dirty, mapping: item.mapping };
    }
    loaded.state.destination = loaded.config.destination;
    if (review.verification.length) loaded.state.verification = path.basename(evidence);
    await writeFile(temporary, `${JSON.stringify(loaded.state, null, 2)}\n`, { mode: 0o600 });
    if ((await load(configFile)).stateHash !== report.stateHash) throw new Error("Checkpoint changed concurrently; scan again");
    await rename(temporary, loaded.stateFile);
  } finally {
    await rm(temporary, { force: true });
    await rm(lock, { recursive: true });
  }
}

if (import.meta.main) {
  const [command, configFile, reportFile, reviewFile] = process.argv.slice(2);
  try {
    if (command === "scan" && configFile && !reportFile) {
      console.log(JSON.stringify(await scan(configFile), null, 2));
    } else if (command === "checkpoint" && configFile && reportFile && reviewFile) {
      await checkpoint(configFile, await Bun.file(reportFile).json(), await Bun.file(reviewFile).json());
      console.log("Checkpoint saved; omitted and pending items remain for the next scan.");
    } else {
      throw new Error("Usage: bun sync-harness.ts scan CONFIG | checkpoint CONFIG REPORT REVIEW");
    }
  } catch (error) { console.error((error as Error).message); process.exitCode = 1; }
}
