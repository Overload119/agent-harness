import process, { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";

function isYes(value: string): boolean {
  return /^(y|yes)$/i.test(value.trim());
}

export async function confirmInstall(targetRoot: string): Promise<void> {
  const prompt = `This will install agent harness into ${targetRoot}. Continue? [y/N] `;

  if (!input.isTTY) {
    console.error(prompt);
    console.error("Re-run interactively to confirm the install.");
    process.exit(1);
  }

  const rl = readline.createInterface({ input, output });

  try {
    const response = await rl.question(prompt);
    if (!isYes(response)) {
      console.log("Aborted.");
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}
