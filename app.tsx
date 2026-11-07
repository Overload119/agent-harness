import { definePluginApp, useSettings } from "@get-bb/plugin-sdk/app";
import { QuestionsPanel } from "./plugin/questions-view";
import "./plugin/app.css";
import { SetupSection, SetupInteraction } from "./plugin/goals/setup-view";
import { GoalsPanel, useGoalsVisible } from "./plugin/goals/goals-view";
import "./plugin/goals/styles.css";

export default definePluginApp((app) => {
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
