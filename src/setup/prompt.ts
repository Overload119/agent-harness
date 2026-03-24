import { createReadStream, createWriteStream, openSync } from "node:fs";
import process, { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";

function isYes(value: string): boolean {
  return /^(y|yes)$/i.test(value.trim());
}

export async function confirmInstall(targetRoot: string): Promise<void> {
  const prompt = `This will install agent harness into ${targetRoot}. Continue? [y/N] `;

  let terminalInput: typeof input | null = input;
  let terminalOutput: typeof output | null = output;

  if (!input.isTTY || !output.isTTY) {
    try {
      const inputFd = openSync("/dev/tty", "r");
      const outputFd = openSync("/dev/tty", "w");
      terminalInput = createReadStream("/dev/tty", { fd: inputFd, autoClose: true });
      terminalOutput = createWriteStream("/dev/tty", { fd: outputFd, autoClose: true });
    } catch {
      terminalInput = null;
      terminalOutput = null;
    }
  }

  if (!terminalInput || !terminalOutput) {
    console.error(prompt);
    console.error("Re-run interactively to confirm the install.");
    process.exit(1);
  }

  const rl = readline.createInterface({ input: terminalInput, output: terminalOutput });

  try {
    const response = await rl.question(prompt);
    if (!isYes(response)) {
      console.log("Aborted.");
      process.exit(1);
    }
  } finally {
    rl.close();
    if (terminalInput !== input) {
      terminalInput.destroy();
    }
    if (terminalOutput !== output) {
      terminalOutput.end();
    }
  }
}
