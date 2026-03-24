import process from "node:process";

import { runRunStateCli } from "./run-state/run";

runRunStateCli(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
