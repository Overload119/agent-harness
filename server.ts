import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { questionsMethods, listQuestions, newQuestion, setQuestionArchived } from "./plugin/questions";
import { STANDING_INSTRUCTIONS } from "./src/plugin/instructions";

import { methods as goalsMethods } from "./plugin/goals/contract";
import { createGoalsService } from "./plugin/goals/service";
import { runAutomation, type RunAutomation } from "./plugin/goals/automation";
import { registerHarnessCli } from "./plugin/goals/cli";

export const rpcContract = defineRpcContract({ ...questionsMethods, ...goalsMethods });

export async function registerAgentHarness(bb: BbPluginApi, automation: RunAutomation = runAutomation) {
  const settings = bb.settings.define({
    sideChats: { type: "boolean", label: "Show Side chats", default: true },
    standingInstructions: {
      type: "boolean",
      label: "Use communication, request-modifier, and artifact preferences",
      default: true,
    },
  });
  let enabled = (await settings.get()).standingInstructions;
  settings.onChange(next => { enabled = next.standingInstructions; });

  const goals = createGoalsService(bb, automation, { get: () => settings.get(), set: value => settings.experimental_set(value) });
  await goals.initialize();
  registerHarnessCli(bb, goals);
  bb.agents.contributeInstructions(({ threadId }) => {
    const goalInstructions = threadId === goals.target() ? "This is the configured Goals thread. For a brief or explicit goal update, use weekly-goals-brief and read bb agent-harness goals get --json. Other sources remain read-only." : "";
    return [enabled ? STANDING_INSTRUCTIONS : "", goalInstructions].filter(Boolean).join("\n\n") || null;
  });
  bb.rpc.register(rpcContract, {
    setupRead: () => goals.readSetup(),
    setupOptions: ({ projectId }) => goals.options(projectId),
    setupPreview: input => goals.preview(input),
    setupApply: input => goals.apply(input),
    goalsRead: ({ threadId }) => goals.readGoals(threadId),
    goalsSave: input => goals.saveGoals(input),
    questions: ({ sourceThreadId, offset }) => listQuestions(bb.sdk, sourceThreadId, offset),
    newQuestion: ({ sourceThreadId }) => newQuestion(bb.sdk, sourceThreadId),
    archiveQuestion: ({ sourceThreadId, threadId }) => setQuestionArchived(bb.sdk, sourceThreadId, threadId, true),
    restoreQuestion: ({ sourceThreadId, threadId }) => setQuestionArchived(bb.sdk, sourceThreadId, threadId, false),
  });
}

export default async function agentHarness(bb: BbPluginApi) { await registerAgentHarness(bb); }
