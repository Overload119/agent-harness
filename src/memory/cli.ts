import { Command } from "commander";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const HARNESS_DIR = ".agent-harness";
const MEMORY_DIR = path.join(HARNESS_DIR, "memory");
const SKILL_PATH = path.resolve(import.meta.dir, "..", ".agents", "skills", "compound", "SKILL.md");

async function readSkill(): Promise<string> {
  return await readFile(SKILL_PATH, "utf8");
}

function createProgram(): Command {
  const program = new Command();

  program
    .name("ah-memory")
    .description("Manage agent harness memory entries.")
    .enablePositionalOptions();

  const consolidateCmd = program
    .command("consolidate")
    .description("Consolidate memory files to remove duplicates and stale content.")
    .option("--dry", "Preview consolidation without writing.");

  consolidateCmd.action(async (options: { dry?: boolean }) => {
    const skill = await readSkill();

    const prompt = [
      "Use the ah-compound skill for this task.",
      "",
      "Your job is to consolidate the memory files in .agent-harness/memory/.",
      "",
      skill,
      "",
      "## Consolidation Task",
      options.dry
        ? "Preview what consolidation would do. Report what entries would be merged, removed, or compacted WITHOUT writing any changes."
        : "Consolidate all 6 category files in .agent-harness/memory/. Remove duplicate entries, merge similar entries, remove stale content, and ensure each file stays under 500 lines.",
      "",
      "## Memory file locations",
      "- .agent-harness/memory/ARCHITECTURE.md",
      "- .agent-harness/memory/BACKEND.md",
      "- .agent-harness/memory/FRONTEND.md",
      "- .agent-harness/memory/PRODUCT.md",
      "- .agent-harness/memory/BUSINESS.md",
      "- .agent-harness/memory/USER_PREFERENCES.md",
      "",
      "Work in the current directory. Start by reading all 6 files to understand what needs consolidation.",
    ].join("\n");

    const cwd = process.cwd();

    await new Promise((resolve, reject) => {
      const proc = spawn(
        "opencode",
        ["run", "--dir", cwd, prompt],
        {
          cwd,
          stdio: "inherit",
          env: { ...process.env },
        },
      );
      proc.on("close", (code) => {
        if (code === 0) resolve(undefined);
        else reject(new Error(`opencode exited with code ${code}`));
      });
      proc.on("error", reject);
    });
  });

  return program;
}

export async function runMemoryCli(argv: string[]): Promise<void> {
  const program = createProgram();
  program.parse(argv);
}
