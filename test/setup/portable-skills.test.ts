import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { exportPortableSkills, PORTABLE_SKILLS } from "../../scripts/export-skills";
import { manifestFor } from "../../src/setup/manifest";
import { createRepoFixture } from "../support/fixtures";

const rootDir = path.resolve(import.meta.dir, "..", "..");

test("portable export is standalone, current, and removes obsolete output", async () => {
  const fixture = await createRepoFixture("ah-portable-skills-");
  const outputDir = fixture.filePath("export");
  try {
    await fixture.writeText("export/obsolete/SKILL.md", "obsolete");
    await exportPortableSkills(outputDir);
    expect((await readdir(outputDir)).sort()).toEqual([...PORTABLE_SKILLS].sort());

    for (const name of PORTABLE_SKILLS) {
      const content = await Bun.file(path.join(outputDir, name, "SKILL.md")).text();
      const frontmatter = content.match(/^---\n([\s\S]*?)\n---\n/);
      expect(frontmatter).not.toBeNull();
      const metadata = Bun.YAML.parse(frontmatter![1]) as { name: string; description: string };
      expect(metadata.name).toBe(name);
      expect(typeof metadata.description).toBe("string");
      expect(metadata.description.length).toBeGreaterThan(0);
      expect(metadata.description.length).toBeLessThanOrEqual(1024);
      expect(content).not.toMatch(/\{[{%]|\/Users\/|\/home\/dev\/|plugin:\/\/|yc rr/);
      for (const match of content.matchAll(/\]\((references\/[^)]+)\)/g)) {
        expect(await Bun.file(path.join(outputDir, name, match[1])).exists()).toBe(true);
      }
      expect(await manifestFor(path.join(outputDir, name))).toEqual(
        await manifestFor(path.join(rootDir, "dist", "skills", name)),
      );
    }

    const firstManifest = await manifestFor(outputDir);
    await exportPortableSkills(outputDir);
    expect(await manifestFor(outputDir)).toEqual(firstManifest);
    expect(await manifestFor(path.join(rootDir, "dist", "plugin-skills", "side-chats"))).toEqual(
      await manifestFor(path.join(outputDir, "side-chats")),
    );
  } finally {
    await fixture.cleanup();
  }
});
