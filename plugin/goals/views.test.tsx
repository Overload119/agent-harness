import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { defaultConfiguration, type SetupState, type Snapshot } from "./contract";

test("setup reviews before applying, guards repeat clicks, retains draft on failure; Goals preserves edits and conflicts", async () => {
  const window = new Window();
  const globals = { window, document: window.document, navigator: window.navigator, HTMLElement: window.HTMLElement,
    Element: window.Element, Node: window.Node, MutationObserver: window.MutationObserver, Event: window.Event,
    getComputedStyle: window.getComputedStyle.bind(window), IS_REACT_ACT_ENVIRONMENT: true };
  const before = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const previous = process.env.RTL_SKIP_AUTO_CLEANUP; process.env.RTL_SKIP_AUTO_CLEANUP = "true";
  const { act, render, fireEvent, cleanup } = await import("@testing-library/react");
  const { SetupForm } = await import("./setup-view");
  const { GoalsEditor } = await import("./editor");
  const { loadPluginApp } = await import("@get-bb/plugin-sdk/testing/app");
  if (previous === undefined) delete process.env.RTL_SKIP_AUTO_CLEANUP; else process.env.RTL_SKIP_AUTO_CLEANUP = previous;
  try {
    const registrations = await loadPluginApp(() => import("../../app"));
    expect(registrations.settingsSections.some(item => item.id === "setup")).toBe(true);
    expect(registrations.pendingInteractions.some(item => item.id === "setup")).toBe(true);
    expect(registrations.tabs.some(item => item.id === "goals")).toBe(true);
    const state: SetupState = { revision: 0, configuration: defaultConfiguration(), automationId: null, automationProjectId: null, pending: false, error: null };
    let calls = 0;
    let rejectApply: ((error: Error) => void) | undefined;
    const form = render(<SetupForm api={{
      read: async () => state,
      options: async () => ({ projects: [], environments: [], threads: [], providers: [], truncated: false }),
      preview: async input => ({ summary: ["No schedule will start."], configuration: input.configuration }),
      apply: async () => { calls++; return new Promise<SetupState>((_, reject) => { rejectApply = reject; }); },
    }} />);
    await act(async () => {});
    expect(calls).toBe(0);
    expect(form.queryByText("Apply setup")).toBeNull();
    await act(async () => fireEvent.click(form.getByText("Review setup", { selector: "button" })));
    expect(form.getByText("No schedule will start.")).toBeTruthy();
    await act(async () => { fireEvent.click(form.getByText("Apply setup")); fireEvent.click(form.getByText("Apply setup")); });
    expect(calls).toBe(1);
    await act(async () => rejectApply!(new Error("Schedule temporarily unavailable")));
    expect(form.getByRole("alert").textContent).toContain("temporarily unavailable");
    expect(form.getByText("Apply setup")).toBeTruthy();
    await act(async () => fireEvent.click(form.getByLabelText("Side chats")));
    expect(form.queryByText("Apply setup")).toBeNull();
    form.unmount();

    const initial: Snapshot = { setupRevision: 1, goals: { threadId: "thr_goals", text: "Original", revision: 1, weekOf: "2026-11-02", timezone: "UTC", updatedAt: "2026-11-02T10:00:00Z" },
      currentWeek: "2026-11-02", timezone: "UTC", stale: false, schedule: "Manual briefs only", configuration: defaultConfiguration() };
    let resolveSave: ((value: Snapshot) => void) | undefined;
    let readValue = initial;
    let rejectNext = false;
    const editor = render(<GoalsEditor api={{ read: async () => readValue,
      save: async (text, revision, week, timezone) => {
        expect(revision).toBe(1); expect(week).toBe("2026-11-02"); expect(timezone).toBe("UTC");
        if (rejectNext) throw new Error("Goals changed in another window");
        expect(text).toBe("Submitted"); return new Promise(resolve => { resolveSave = resolve; });
      },
    }} />);
    await act(async () => {});
    const field = editor.getByRole("textbox") as HTMLTextAreaElement;
    await act(async () => fireEvent.change(field, { target: { value: "Submitted" } }));
    await act(async () => fireEvent.click(editor.getByText("Save goals", { selector: "button" })));
    await act(async () => fireEvent.change(field, { target: { value: "Newer draft" } }));
    await act(async () => resolveSave!({ ...initial, goals: { ...initial.goals, text: "Submitted" } }));
    expect(field.value).toBe("Newer draft");
    expect(editor.getByText(/latest edits are not saved/)).toBeTruthy();
    rejectNext = true;
    await act(async () => fireEvent.click(editor.getByText("Save goals", { selector: "button" })));
    expect(editor.getByRole("alert").textContent).toContain("another window");
    readValue = { ...initial, goals: { ...initial.goals, text: "Other window", revision: 2 } };
    await act(async () => fireEvent.click(editor.getByText("Reload saved goals")));
    expect(field.value).toBe("Newer draft");
    expect(editor.getByText("Other window")).toBeTruthy();
    await act(async () => fireEvent.click(editor.getByText("Use saved version")));
    expect(field.value).toBe("Other window");
    editor.unmount();
  } finally {
    cleanup();
    for (const [key, descriptor] of Object.entries(before)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
    await window.happyDOM.close();
  }
});
