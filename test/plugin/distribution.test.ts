import { expect, test } from "bun:test";
import { cp, readdir } from "node:fs/promises";
import path from "node:path";
import { exportHarnessSkills } from "../../scripts/export-skills";
import { manifestFor } from "../../src/setup/manifest";
import { createRepoFixture } from "../support/fixtures";

const root = path.resolve(import.meta.dir, "../..");

test("maintained and shipped guidance has no personal or organization-specific dependencies", async () => {
  const files = ["README.md", "AGENTS.md", "AGENTS.example.md", "PLUGIN_OVERVIEW.md"];
  for (const directory of ["skills", "instructions", "src", "plugin", "dist/skills", "dist/plugin-skills"]) {
    for await (const file of new Bun.Glob("**/*.{md,liquid,yaml}").scan(path.join(root, directory))) {
      files.push(path.join(directory, file));
    }
  }
  const privateContent = /\b(?:Amir Sharif|amirsharif|YC|yc-software|ycombinator|vault|obsidian)\b|\/Users\/|\/home\/dev\/|\b(?:host|thr|proj|env)_[a-z0-9]{10,}\b/i;
  for (const file of files) {
    const content = await Bun.file(path.join(root, file)).text();
    expect({ file, matches: content.match(privateContent) }).toEqual({ file, matches: null });
  }
});

test("root BB package ships current skills and references, without the retired planning pair", async () => {
  const fixture = await createRepoFixture("ah-plugin-export-");
  try {
    const exported = fixture.filePath("skills");
    await exportHarnessSkills(exported);
    const manifest = await Bun.file(path.join(root, "package.json")).json();
    expect(manifest.name).toBe("bb-plugin-agent-harness");
    expect(manifest.bb.skills).toEqual(["dist/plugin-skills"]);
    expect(await manifestFor(exported)).toEqual(await manifestFor(path.join(root, "dist/plugin-skills")));
    const names = await readdir(exported);
    expect(names).toContain("r-plan");
    for (const old of ["ah-plan", "ah-prd", "plan", "prd"]) expect(names).not.toContain(old);
    for (const name of names) {
      const skill = await Bun.file(path.join(exported, name, "SKILL.md")).text();
      expect(skill).toContain(`name: ${name}\n`);
      for (const match of skill.matchAll(/\]\((references\/[^)]+)\)/g)) {
        expect(await Bun.file(path.join(exported, name, match[1])).exists()).toBe(true);
      }
    }
    const planning = await Bun.file(path.join(exported, "r-plan/SKILL.md")).text();
    expect(planning).toContain("No separate PRD conversion is needed.");
    expect(await Bun.file(path.join(exported, "r-plan/references/format.md")).text()).toContain(".agent-harness/tasks/<task-name>/PLAN.md");
  } finally { await fixture.cleanup(); }
});

test("the plugin's Mermaid helper works outside its checkout without node_modules", async () => {
  const fixture = await createRepoFixture("ah-plugin-mermaid-");
  try {
    const helper = fixture.filePath("render-mermaid.ts");
    await cp(path.join(root, "dist/plugin-skills/ah-mermaid/scripts/render-mermaid.ts"), helper);
    const source = await fixture.writeText("flow.md", "```mermaid\nflowchart LR\n  Request --> Plan\n```\n");
    const output = fixture.filePath("flow.html");
    const child = Bun.spawn([process.execPath, helper, source, output, "Planning flow"], {
      cwd: fixture.rootDir, stdout: "pipe", stderr: "pipe",
    });
    const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(await Bun.file(output).text()).toContain("<svg");
  } finally { await fixture.cleanup(); }
});
