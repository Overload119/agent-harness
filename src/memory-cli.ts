import process from "node:process";

import { runMemoryCli } from "./memory/cli";

runMemoryCli(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
