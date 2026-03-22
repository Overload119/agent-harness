import process from "node:process";

import { runVisualizerCli } from "./visualizer/run";

runVisualizerCli(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
