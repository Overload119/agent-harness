import process from "node:process";

import { runLoopCli } from "./loop/run";

runLoopCli(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
