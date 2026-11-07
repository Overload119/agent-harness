import { expect, test, spyOn } from "bun:test";
import { Window } from "happy-dom";
import type { Question } from "./questions";

const question = (threadId: string, text: string, createdAt: number): Question => ({
  threadId, question: text, createdAt, status: "idle", error: null,
});

test("Questions keeps native chats separate, guards repeated creation, preserves selection on failed refresh and ignores stale responses", async () => {
  const window = new Window();
  const globals = { window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, Element: window.Element, Node: window.Node,
    ResizeObserver: window.ResizeObserver,
    MutationObserver: window.MutationObserver, CustomEvent: window.CustomEvent,
    Event: window.Event, getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window), IS_REACT_ACT_ENVIRONMENT: true };
  const before = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const { act } = await import("react");
  const previousCleanup = process.env.RTL_SKIP_AUTO_CLEANUP;
  process.env.RTL_SKIP_AUTO_CLEANUP = "true";
  const { loadPluginApp, renderSlot } = await import("@get-bb/plugin-sdk/testing/app");
  if (previousCleanup === undefined) delete process.env.RTL_SKIP_AUTO_CLEANUP;
  else process.env.RTL_SKIP_AUTO_CLEANUP = previousCleanup;
  try {
    const app = await loadPluginApp(() => import("../app"));
    const registration = app.tabs.find(tab => tab.id === "questions")!;
    expect(registration.availability).toBe("fixed");
    expect(registration.title).toBe("Side chats");
    let rows = [question("one", "Why does this fail?", 1), question("two", "Can we simplify it?", 2)];
    let failList = false;
    let finishCreate: ((value: Question) => void) | undefined;
    let calls = 0;
    const slot = renderSlot(registration, { threadId: "main" }, {
      rpc: {
        questions: () => { if (failList) throw new Error("Disconnected"); return { items: rows, nextOffset: null }; },
        newQuestion: () => { calls++; return new Promise<Question>(resolve => { finishCreate = resolve; }); },
      },
      sdk: { threads: { queuedMessages: { create: async () => ({}) } } },
    });
    const selected = () => window.document.querySelector('[data-testid="bb-thread-chat"]')?.getAttribute("data-thread-id");
    const button = (text: string) => [...window.document.querySelectorAll("button")].find(node =>
      (node.querySelector(".questions-label")?.textContent ?? node.textContent) === text)!;
    try {
      await act(async () => {});
      expect(selected()).toBe("two");
      await act(async () => button("Why does this fail?").click());
      expect(selected()).toBe("one");
      const initialRows = rows;
      rows = [rows[1]!];
      await act(async () => window.dispatchEvent(new window.Event("focus")));
      expect(selected()).toBe("one");
      rows = initialRows;
      await act(async () => window.dispatchEvent(new window.Event("focus")));
      await act(async () => button("Send to main thread").click());
      expect(slot.inspection.sdkCalls.find(call => call.method === "threads.queuedMessages.create")?.args).toMatchObject([{
        threadId: "main", senderThreadId: "one", input: [{ type: "text", text: "test message text" }],
      }]);
      failList = true;
      await act(async () => window.dispatchEvent(new window.Event("focus")));
      expect(selected()).toBe("one");
      expect(window.document.querySelector('[role="alert"]')?.textContent).toContain("Disconnected");
      failList = false;
      await act(async () => { button("+ New chat").click(); button("+ New chat").click(); });
      expect(calls).toBe(1);
      expect(button("Starting…").disabled).toBe(true);
      rows = [...rows, question("three", "New question", 3)];
      await act(async () => finishCreate!(rows[2]!));
      expect(selected()).toBe("three");
      await act(async () => button("Why does this fail?").click());
      expect(selected()).toBe("one");
      await act(async () => button("New question").click());
      expect(selected()).toBe("three");
      expect(slot.inspection.navigateCalls).toEqual([]);
    } finally { await act(async () => slot.lifecycle.unmount()); }

    let resolveOld: ((result: { items: Question[]; nextOffset: null }) => void) | undefined;
    const old = renderSlot(registration, { threadId: "old-source" }, { rpc: {
      questions: () => new Promise(resolve => { resolveOld = resolve; }),
    } });
    await act(async () => {});
    await act(async () => old.lifecycle.unmount());
    const fresh = renderSlot(registration, { threadId: "new-source" }, { rpc: {
      questions: () => ({ items: [question("fresh", "Fresh question?", 4)], nextOffset: null }),
    } });
    try {
      await act(async () => {});
      await act(async () => resolveOld!({ items: [question("stale", "Wrong question?", 9)], nextOffset: null }));
      expect(selected()).toBe("fresh");
      expect(window.document.body.textContent).not.toContain("Wrong question?");
    } finally { await act(async () => fresh.lifecycle.unmount()); }

    const { toast } = await import("sonner");
    const success = spyOn(toast, "success").mockReturnValue(1);
    const failure = spyOn(toast, "error").mockReturnValue(2);
    const first = question("first", "A long original question with multiple details\nand a second line?", 1);
    const second = question("second", "Another chat?", 2);
    let archiveRows = [first, second];
    let finishArchive: (() => void) | undefined;
    let finishStale: (() => void) | undefined;
    let deferList = false;
    let failArchive = false;
    let archiveCalls = 0;
    const archiveSlot = renderSlot(registration, { threadId: "archive-source" }, { rpc: {
      questions: () => {
        if (deferList) {
          deferList = false;
          const snapshot = [...archiveRows];
          return new Promise(resolve => { finishStale = () => resolve({ items: snapshot, nextOffset: null }); });
        }
        return { items: archiveRows, nextOffset: null };
      },
      archiveQuestion: ({ sourceThreadId, threadId }: { sourceThreadId: string; threadId: string }) => {
        expect(sourceThreadId).toBe("archive-source");
        archiveCalls++;
        if (failArchive) throw new Error("Could not archive");
        return new Promise(resolve => { finishArchive = () => {
          archiveRows = archiveRows.filter(row => row.threadId !== threadId);
          resolve({ changed: true });
        }; });
      },
      restoreQuestion: ({ threadId }: { threadId: string }) => {
        archiveRows = [...archiveRows, threadId === "first" ? first : second];
        return { changed: true };
      },
    } });
    const archiveButton = (text: string) => window.document.querySelector<HTMLButtonElement>(`[aria-label="Archive chat: ${text}"]`)!;
    const undo = () => {
      const action = success.mock.calls.filter(call => call[0] === "Side chat archived").at(-1)?.[1]?.action as { onClick: () => void };
      expect(action).toBeDefined();
      action.onClick();
    };
    try {
      await act(async () => {});
      expect(selected()).toBe("second");
      expect(window.document.querySelector('[role="tooltip"]')).toBeNull();
      await act(async () => button(first.question!).focus());
      expect(window.document.querySelector('[role="tooltip"]')?.textContent).toBe(first.question);
      await act(async () => button(first.question!).blur());
      // Use the sibling control to ensure an archive click never selects its row.
      const firstArchive = window.document.querySelector<HTMLButtonElement>(".questions-row:last-child .questions-archive")!;
      await act(async () => { firstArchive.click(); firstArchive.click(); });
      expect(archiveCalls).toBe(1);
      expect(firstArchive.disabled).toBe(true);
      expect(selected()).toBe("second");
      deferList = true;
      await act(async () => window.dispatchEvent(new window.Event("focus")));
      await act(async () => finishArchive!());
      expect(window.document.querySelectorAll(".questions-row")).toHaveLength(1);
      await act(async () => finishStale!());
      expect(window.document.querySelectorAll(".questions-row")).toHaveLength(1);
      expect(selected()).toBe("second");
      await act(async () => undo());
      expect(window.document.querySelectorAll(".questions-row")).toHaveLength(2);
      expect(selected()).toBe("second");
      await act(async () => button(first.question!).click());
      failArchive = true;
      await act(async () => window.document.querySelector<HTMLButtonElement>(".questions-row:last-child .questions-archive")!.click());
      expect(selected()).toBe("first");
      expect(window.document.querySelectorAll(".questions-row")).toHaveLength(2);
      expect(failure).toHaveBeenCalledWith("Could not archive");
      failArchive = false;
      await act(async () => window.document.querySelector<HTMLButtonElement>(".questions-row:last-child .questions-archive")!.click());
      await act(async () => finishArchive!());
      expect(selected()).toBe("second");
      await act(async () => archiveButton("Another chat?").click());
      await act(async () => finishArchive!());
      expect(selected()).toBeUndefined();
      expect(window.document.querySelectorAll(".questions-row")).toHaveLength(0);
      await act(async () => undo());
      expect(selected()).toBe("second");
    } finally {
      await act(async () => archiveSlot.lifecycle.unmount());
      success.mockRestore();
      failure.mockRestore();
    }
  } finally {
    await window.happyDOM.close();
    for (const [key, descriptor] of Object.entries(before)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
