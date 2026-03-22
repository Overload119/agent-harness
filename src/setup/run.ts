import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Command } from "commander";

import { TEMPLATE_VARIABLES } from "./constants";
import { pathExists } from "./fs";
import { ensureGitignoreEntry } from "./gitignore";
import { renderedManifestFor, manifestFor, manifestsEqual } from "./manifest";
import { loadMetadata } from "./metadata";
import { confirmInstall } from "./prompt";
import { currentCommit, managedSkillTargetPath, resolveSetupPaths } from "./runtime";
import { listSkillDirectories, skillNameFromSource, writeSkillDirectory } from "./skills";
import type { SetupOptions } from "./types";

async function removePath(targetPath: string): Promise<void> {
  await rm(targetPath, { force: true, recursive: true });
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("setup")
    .description("Install harness skills into the current repo.")
    .option("--dry", "Preview install or upgrade actions without changing files")
    .option("--overwrite", "Replace harness-managed skills with the current harness copy")
    .helpOption("-h, --help");

  return program;
}

export async function runSetupCli(argv: string[]): Promise<void> {
  const program = createProgram();
  program.parse(argv);
  await runSetup(program.opts<SetupOptions>(), argv);
}

export async function runSetup(options: SetupOptions, argv: string[]): Promise<void> {
  const paths = resolveSetupPaths(argv);

  if (!(await pathExists(paths.sourceDir))) {
    console.error(`Source skills directory not found: ${paths.sourceDir}`);
    process.exit(1);
  }

  if (!(await pathExists(paths.targetRoot))) {
    console.error(`Target directory not found: ${paths.targetRoot}`);
    process.exit(1);
  }

  if (!options.dry) {
    await confirmInstall(paths.targetRoot);
  }

  await ensureGitignoreEntry(paths.targetRoot, options.dry === true);

  const metadata = await loadMetadata(paths.metadataPath);
  metadata.source = {
    repoRoot: paths.repoRoot,
    commit: currentCommit(paths.repoRoot),
  };
  metadata.targetRoot = paths.targetRoot;

  const skills = await listSkillDirectories(paths.sourceDir);
  if (skills.length === 0) {
    console.error(`No skills found in ${paths.sourceDir}`);
    process.exit(1);
  }

  const counts = {
    installed: 0,
    updated: 0,
    up_to_date: 0,
    removed: 0,
    skipped: 0,
  };

  const sourceSkillNames = new Set(skills.map((skillDir) => skillNameFromSource(path.basename(skillDir))));
  const prefix = options.dry ? "Would " : "";

  for (const sourceSkillDir of skills) {
    const sourceSkillName = path.basename(sourceSkillDir);
    const skillName = skillNameFromSource(sourceSkillName);
    const targetSkillDir = path.join(paths.targetDir, skillName);
    const sourceManifest = await renderedManifestFor(sourceSkillDir, TEMPLATE_VARIABLES);

    const record = metadata.skills[skillName] || {};
    const managed = record.managed === true && record.targetPath === managedSkillTargetPath(skillName);
    const installedManifest = managed ? record.installedFiles || {} : {};
    const targetExists = await pathExists(targetSkillDir);
    const targetManifest = await manifestFor(targetSkillDir);
    const targetModified = managed && targetExists && !manifestsEqual(targetManifest, installedManifest);
    const sourceChanged = managed && !manifestsEqual(sourceManifest, installedManifest);

    let status = "";
    let detail = "";

    if (!targetExists) {
      status = "install";
    } else if (!managed) {
      status = "skip";
      detail = "existing directory is not managed by agent-harness";
    } else if (options.overwrite) {
      if (manifestsEqual(targetManifest, sourceManifest)) {
        status = "up_to_date";
      } else {
        status = "update";
        if (targetModified && sourceChanged) {
          detail = "overwriting local changes with updated harness files";
        } else if (targetModified) {
          detail = "overwriting local changes with harness files";
        } else if (sourceChanged) {
          detail = "upgrading to the latest harness files";
        }
      }
    } else if (targetModified && sourceChanged) {
      status = "skip";
      detail = "managed skill has local changes and a harness update is available; re-run with --overwrite";
    } else if (targetModified) {
      status = "skip";
      detail = "managed skill has local changes; re-run with --overwrite to restore harness files";
    } else if (sourceChanged || !manifestsEqual(targetManifest, sourceManifest)) {
      status = "skip";
      detail = "managed skill differs from the current harness copy; re-run with --overwrite";
    } else {
      status = "up_to_date";
    }

    if (status === "install") {
      console.log(`${prefix}install: ${skillName}`);
      counts.installed += 1;
      if (!options.dry) {
        await mkdir(paths.targetDir, { recursive: true });
        await writeSkillDirectory(sourceSkillDir, targetSkillDir, TEMPLATE_VARIABLES);
        metadata.skills[skillName] = {
          managed: true,
          sourceSkill: sourceSkillName,
          sourcePath: sourceSkillDir,
          targetPath: managedSkillTargetPath(skillName),
          installedFiles: sourceManifest,
        };
      }
      continue;
    }

    if (status === "update") {
      console.log(detail ? `${prefix}update: ${skillName} (${detail})` : `${prefix}update: ${skillName}`);
      counts.updated += 1;
      if (!options.dry) {
        await mkdir(paths.targetDir, { recursive: true });
        await removePath(targetSkillDir);
        await writeSkillDirectory(sourceSkillDir, targetSkillDir, TEMPLATE_VARIABLES);
        metadata.skills[skillName] = {
          managed: true,
          sourceSkill: sourceSkillName,
          sourcePath: sourceSkillDir,
          targetPath: managedSkillTargetPath(skillName),
          installedFiles: sourceManifest,
        };
      }
      continue;
    }

    if (status === "up_to_date") {
      console.log(`${prefix}up to date: ${skillName}`);
      counts.up_to_date += 1;
      continue;
    }

    console.log(`${prefix}skip: ${skillName} (${detail})`);
    counts.skipped += 1;
  }

  const staleRecords: Array<[string, string]> = [];
  for (const skillName of Object.keys(metadata.skills).sort()) {
    if (sourceSkillNames.has(skillName)) {
      continue;
    }

    const record = metadata.skills[skillName];
    if (record.managed !== true || record.targetPath !== managedSkillTargetPath(skillName)) {
      continue;
    }

    const targetSkillDir = path.join(paths.targetDir, skillName);
    const installedManifest = record.installedFiles || {};
    const targetManifest = await manifestFor(targetSkillDir);

    if (!(await pathExists(targetSkillDir))) {
      staleRecords.push([skillName, "remove record for missing managed skill"]);
    } else if (manifestsEqual(targetManifest, installedManifest)) {
      staleRecords.push([skillName, "remove managed skill no longer shipped by harness"]);
    } else {
      console.log(
        `${prefix}skip stale managed skill: ${skillName} ` +
          "(target has local changes and no longer exists in the harness)",
      );
      counts.skipped += 1;
    }
  }

  for (const [skillName, detail] of staleRecords) {
    if (options.dry) {
      console.log(`Would remove: ${skillName} (${detail})`);
      counts.removed += 1;
      continue;
    }

    const targetSkillDir = path.join(paths.targetDir, skillName);
    if (await pathExists(targetSkillDir)) {
      await removePath(targetSkillDir);
    }
    delete metadata.skills[skillName];
    console.log(`Removed: ${skillName} (${detail})`);
    counts.removed += 1;
  }

  if (!options.dry) {
    await mkdir(paths.targetLogsDir, { recursive: true });
    await mkdir(paths.targetAgentsDir, { recursive: true });
    await Bun.write(paths.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  }

  const mode = options.dry ? "Dry run complete" : "Done";
  console.log(
    `${mode}. Installed ${counts.installed}, updated ${counts.updated}, removed ${counts.removed}, ` +
      `skipped ${counts.skipped}.`,
  );

  if (options.dry) {
    if (options.overwrite) {
      console.log("Run again without --dry to apply these managed upgrades and removals.");
    } else {
      console.log("Run with --dry --overwrite to preview managed upgrades, or --overwrite to apply them.");
    }
  }
}
