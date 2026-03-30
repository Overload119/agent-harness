import { describe, expect, test } from "bun:test";
import path from "node:path";

import { harnessRootFromArgv } from "../../src/visualizer/paths";

describe("harnessRootFromArgv", () => {
  test("returns repo root when harness is installed inside the harness repo", () => {
    const harnessRoot = harnessRootFromArgv([
      process.execPath,
      path.join("/path/to/harness-repo/.agent-harness/bin/ah-vis"),
    ]);
    expect(harnessRoot).toBe("/path/to/harness-repo");
  });

  test("returns foreign repo root when harness is installed to a different repo", () => {
    const harnessRoot = harnessRootFromArgv([
      process.execPath,
      path.join("/path/to/foreign-repo/.agent-harness/bin/ah-vis"),
    ]);
    expect(harnessRoot).toBe("/path/to/foreign-repo");
  });
});
