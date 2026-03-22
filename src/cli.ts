import process from "node:process";

import { runSetupCli } from "./setup/run";

runSetupCli(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
