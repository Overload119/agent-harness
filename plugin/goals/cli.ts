import { cliCommand, defineCli, type BbPluginApi } from "@get-bb/plugin-sdk";
import { configurationSchema } from "./contract";
import type { GoalsService } from "./service";

export function registerHarnessCli(bb: BbPluginApi, goals: GoalsService) {
  bb.cli.register(defineCli({ name: "agent-harness", summary: "Configure Agent Harness and manage saved weekly goals",
    commands: {
      setup: cliCommand({ summary: "Open setup in a BB thread, or preview/apply explicit JSON configuration",
        options: {
          thread: { type: "string", description: "Thread where the setup form opens; defaults to the invoking thread" },
          configuration: { type: "string", description: "Configuration JSON; preview unless --apply is passed" },
          "expected-revision": { type: "string", description: "Setup revision from status, required with --configuration" },
          apply: { type: "boolean", description: "Apply the supplied configuration after reviewing its preview" },
          json: { type: "boolean", description: "Return JSON" },
        },
        async run(input, context) {
          const options = input.options;
          if (options.configuration !== undefined) {
            if (!/^\d+$/.test(options["expected-revision"] ?? "")) throw new Error("Pass --expected-revision from bb agent-harness status --json.");
            const request = { configuration: configurationSchema.parse(JSON.parse(options.configuration)), expectedRevision: Number(options["expected-revision"]) };
            return { exitCode: 0, stdout: JSON.stringify(options.apply ? await goals.apply(request) : await goals.preview(request)) };
          }
          if (options.apply || options["expected-revision"] !== undefined) throw new Error("--apply and --expected-revision require --configuration.");
          const threadId = options.thread || context.threadId;
          if (!threadId) throw new Error("Open Settings → Agent Harness → Setup, or run this command in a BB thread (or pass --thread). For unattended setup, use --configuration and --expected-revision.");
          await bb.sdk.threads.get({ threadId });
          const result = await bb.ui.requestInput({ threadId, rendererId: "setup", title: "Set up Agent Harness", payload: { originThreadId: threadId } }, { signal: context.signal });
          return { exitCode: 0, stdout: result.outcome === "cancelled" ? "Setup cancelled." : JSON.stringify(await goals.readSetup()) };
        },
      }),
      status: cliCommand({ summary: "Read saved setup and any incomplete operation", options: { json: { type: "boolean", description: "Return JSON" } },
        async run() { return { exitCode: 0, stdout: JSON.stringify(await goals.readSetup()) }; } }),
      "goals get": cliCommand({ summary: "Read exact saved goals, configured evidence scope, week and revision; no writes",
        options: { thread: { type: "string", description: "Expected Goals thread" }, json: { type: "boolean", description: "Return JSON" } },
        async run(input) {
          const threadId = input.options.thread || (await goals.readSetup()).configuration.targetThreadId;
          return { exitCode: 0, stdout: JSON.stringify(await goals.readGoals(threadId)) };
        } }),
      "goals set": cliCommand({ summary: "Save explicitly authorized goal text with revision, week and timezone checks",
        options: {
          thread: { type: "string", required: true, description: "Configured Goals thread ID" },
          text: { type: "string", required: true, description: "Exact goal text, up to 12000 characters" },
          "expected-revision": { type: "string", required: true, description: "Goal revision from goals get" },
          "expected-week": { type: "string", required: true, description: "currentWeek from goals get" },
          "expected-timezone": { type: "string", required: true, description: "timezone from goals get" },
          json: { type: "boolean", description: "Return JSON" },
        },
        async run({ options }) {
          if (!/^\d+$/.test(options["expected-revision"])) throw new Error("expected-revision must be a nonnegative integer.");
          const saved = await goals.saveGoals({ threadId: options.thread, text: options.text, expectedRevision: Number(options["expected-revision"]),
            expectedWeek: options["expected-week"], expectedTimezone: options["expected-timezone"] });
          return { exitCode: 0, stdout: JSON.stringify(saved) };
        },
      }),
    },
  }));
}
