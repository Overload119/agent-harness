import { definePluginApp, useSettings, experimental_THREAD_ACTION_GROUPS } from "@get-bb/plugin-sdk/app";
import { QuestionsPanel } from "./plugin/questions-view";
import "./plugin/app.css";
import { SetupSection, SetupInteraction } from "./plugin/goals/setup-view";
import { GoalsPanel, useGoalsVisible } from "./plugin/goals/goals-view";
import "./plugin/goals/styles.css";
import { requestNewChildThread } from "./plugin/new-child-thread";
import { NewChildThreadHandler } from "./plugin/new-child-thread-view";
import "./plugin/new-child-thread.css";

export default definePluginApp((app) => {
  app.composer.experimental_registerCommand({
    id: "new-child-thread", title: "New Child Thread…",
    defaultShortcut: { key: "Enter", mod: true, shift: true },
    run: ({ composer }) => {
      if (composer.scope.kind !== "new-thread") requestNewChildThread(composer.scope.threadId);
    },
  });
  app.slots.experimental_threadAction({
    id: "new-child-thread", title: "New Child Thread…", icon: "Plus",
    group: experimental_THREAD_ACTION_GROUPS.open,
    item: ({ thread }) => ({
      label: "New Child Thread…", icon: "Plus",
      disabled: thread.archivedAt !== null || !thread.environment,
      run: () => requestNewChildThread(thread.id),
    }),
  });
  app.slots.experimental_appOverlay({ id: "new-child-thread", component: NewChildThreadHandler });
  app.slots.experimental_tab({
    context: { kind: "thread" }, availability: "fixed", id: "questions",
    title: "Side chats", icon: "SideChat", component: QuestionsPanel, layout: "flush",
    useVisible: () => useSettings().values?.sideChats !== false,
  });
  app.slots.settingsSection({ id: "setup", title: "Setup", component: SetupSection });
  app.slots.pendingInteraction({ id: "setup", component: SetupInteraction });
  app.slots.experimental_tab({ context: { kind: "thread" }, availability: "fixed", id: "goals",
    title: "Goals", icon: "Target", layout: "flush", component: GoalsPanel,
    useVisible: ({ threadId }) => useGoalsVisible(threadId),
  });
});
