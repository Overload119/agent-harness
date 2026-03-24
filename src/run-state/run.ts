import path from "node:path";
import { Command } from "commander";

import { nowIso, updateRunState } from "../loop/state";

type UpdateOptions = {
  completed?: boolean;
  currentTaskId?: string;
  error?: string;
  exitCode?: string;
  iteration?: string;
  lastMessage?: string;
  message?: string;
  phase?: string;
  runFile?: string;
  status?: string;
};

function createProgram(): Command {
  const program = new Command();

  program
    .name("ah-run-state")
    .description("Update shared ah-loop run state from inside a repo checkout.");

  program
    .command("update")
    .description("Update a run state file under ~/.agent-harness/runs")
    .requiredOption("--run-file <path>", "Absolute path to the run state JSON file")
    .option("--phase <value>", "Phase value to persist")
    .option("--status <value>", "Status value to persist")
    .option("--last-message <value>", "Last message to persist")
    .option("--current-task-id <value>", "Current task id to persist")
    .option("--iteration <number>", "Iteration number to persist")
    .option("--error <value>", "Error message to persist")
    .option("--exit-code <number>", "Exit code to persist")
    .option("--completed", "Mark the run as completed now")
    .action(async (options: UpdateOptions) => {
      const iteration = options.iteration ? Number(options.iteration) : undefined;
      const exitCode = options.exitCode ? Number(options.exitCode) : undefined;

      if (options.iteration && !Number.isInteger(iteration)) {
        throw new Error(`Invalid iteration: ${options.iteration}`);
      }

      if (options.exitCode && !Number.isInteger(exitCode)) {
        throw new Error(`Invalid exit-code: ${options.exitCode}`);
      }

      const runFile = path.resolve(options.runFile || "");
      await updateRunState(runFile, {
        completedAt: options.completed ? nowIso() : undefined,
        currentTaskId: options.currentTaskId,
        error: options.error,
        exitCode,
        iteration,
        lastMessage: options.lastMessage,
        phase: options.phase,
        status: options.status,
      });
    });

  return program;
}

export async function runRunStateCli(argv: string[]): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}
