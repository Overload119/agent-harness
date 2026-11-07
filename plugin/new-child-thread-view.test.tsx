import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createFakeSdk, makeThreadResponse } from "@get-bb/plugin-sdk/testing";
import type { ChildThreadOptions } from "./new-child-thread";

test("native composer uses parent defaults, cancellation and saved navigation preferences", async () => {
  const window = new Window();
  const globals = {
    window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, Element: window.Element, Node: window.Node,
    NodeFilter: window.NodeFilter, HTMLInputElement: window.HTMLInputElement,
    MutationObserver: window.MutationObserver, CustomEvent: window.CustomEvent,
    Event: window.Event, getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const before = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const { act } = await import("react");
  const { NewChildThreadHandler } = await import("./new-child-thread-view");
  // This test owns root cleanup; avoid installing Testing Library hooks inside
  // a running Bun test when the SDK registration harness is loaded lazily.
  const previousCleanup = process.env.RTL_SKIP_AUTO_CLEANUP;
  process.env.RTL_SKIP_AUTO_CLEANUP = "true";
  const { loadPluginApp, renderSlot } = await import("@get-bb/plugin-sdk/testing/app");
  if (previousCleanup === undefined) delete process.env.RTL_SKIP_AUTO_CLEANUP;
  else process.env.RTL_SKIP_AUTO_CLEANUP = previousCleanup;
  const { NEW_CHILD_THREAD_EVENT } = await import("./new-child-thread");
  try {
    const parent = makeThreadResponse({ id: "clicked-parent", title: "Selected parent", environmentId: "env-parent", canSpawnChild: true });
    const { sdk } = createFakeSdk({ pluginId: "agent-harness" });
    const app = await loadPluginApp(() => import("../app"));
    expect(app.appOverlays.some(item => item.id === "new-child-thread")).toBe(true);
    expect(app.commandPaletteActions.find(item => item.id === "new-child-thread")).toMatchObject({
      target: "composer", defaultShortcut: { key: "Enter", mod: true, shift: true },
    });
    const action = app.threadActions.find(item => item.id === "new-child-thread")!;
    let requestedParent = "";
    window.addEventListener(NEW_CHILD_THREAD_EVENT, event => { requestedParent = (event as CustomEvent<string>).detail; });
    const target = {
      id: parent.id, projectId: parent.projectId, parentThreadId: null,
      archivedAt: null, pinnedAt: null, sectionId: null, isUnread: false,
      status: "idle" as const, environment: { id: parent.environmentId!, path: "/selected/workspace" },
    };
    const input = { thread: target, data: undefined, sdk, navigate: {} as Parameters<typeof action.item>[0]["navigate"] };
    const menuItem = action.item(input)!;
    expect(menuItem.disabled).toBe(false);
    await menuItem.run({ requestRename: () => {} });
    expect(requestedParent).toBe(parent.id);
    expect(action.item({ ...input, thread: { ...target, environment: null } })!.disabled).toBe(true);
    expect(action.item({ ...input, thread: { ...target, archivedAt: 1 } })!.disabled).toBe(true);
    for (const stay of [false, true]) {
      for (const saveFails of [false, true]) {
        let stored: ChildThreadOptions | null = null;
        const slot = renderSlot({ component: NewChildThreadHandler }, {}, {
          sdk: { threads: {
            get: async () => parent,
            spawn: async () => makeThreadResponse({ id: "handler-child" }),
          } },
          rpc: {
            childThreadPreferences: () => ({ providerId: "different-harness", parentNotifications: "off", stayOnCurrentPage: true }),
            saveChildThreadPreferences: (options: unknown) => {
              if (saveFails) throw new Error("Storage unavailable");
              stored = options as ChildThreadOptions;
              return { saved: true };
            },
          },
        });
        try {
          await act(async () => { window.dispatchEvent(new window.CustomEvent(NEW_CHILD_THREAD_EVENT, { detail: parent.id })); });
          const composer = window.document.querySelector('[data-testid="bb-new-thread-composer"]')!;
          expect(composer.getAttribute("data-default-project-id")).toBe(parent.projectId);
          expect(composer.getAttribute("data-default-provider-id")).toBe("different-harness");
          expect(JSON.parse(composer.getAttribute("data-default-environment")!)).toEqual({ type: "reuse", environmentId: parent.environmentId });
          expect(composer.getAttribute("data-draft-key")).toBe(`agent-harness:child:${parent.id}`);
          // Cancel does not spawn. Reopen through the real handler.
          await act(async () => { [...window.document.querySelectorAll("button")].find(button => button.textContent === "Cancel")!.click(); });
          expect(slot.inspection.sdkCalls.filter(call => call.method === "threads.spawn")).toHaveLength(0);
          await act(async () => { window.dispatchEvent(new window.CustomEvent(NEW_CHILD_THREAD_EVENT, { detail: parent.id })); });
          const checkbox = window.document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
          expect(checkbox.checked).toBe(true);
          if (!stay) await act(async () => checkbox.click());
          const promptInput = window.document.querySelector("textarea")!;
          await act(async () => {
            Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!.call(promptInput, "Test creation");
            promptInput.dispatchEvent(new window.Event("input", { bubbles: true }));
          });
          await act(async () => {
            window.document.querySelector<HTMLButtonElement>('[data-testid="bb-new-thread-composer-submit"]')!.click();
          });
          expect(window.document.querySelector('[role="dialog"]')).toBeNull();
          expect(slot.inspection.navigateCalls).toEqual(stay ? [] : [{ method: "toThread", threadId: "handler-child" }]);
          if (!saveFails) expect(stored).toMatchObject({ stayOnCurrentPage: stay });
        } finally {
          await act(async () => slot.lifecycle.unmount());
        }
      }
    }

    // First use seeds the actual parent, without any imported preferences.
    const initial = renderSlot({ component: NewChildThreadHandler }, {}, {
      sdk: { threads: { get: async () => parent } },
      rpc: { childThreadPreferences: () => null },
    });
    try {
      await act(async () => { window.dispatchEvent(new window.CustomEvent(NEW_CHILD_THREAD_EVENT, { detail: parent.id })); });
      const composer = window.document.querySelector('[data-testid="bb-new-thread-composer"]')!;
      expect(composer.getAttribute("data-default-provider-id")).toBe(parent.providerId);
      expect(window.document.querySelector<HTMLSelectElement>("select")!.value).toBe("auto");
      expect(window.document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
      expect(initial.inspection.sdkCalls.filter(call => call.method === "threads.spawn")).toHaveLength(0);
    } finally { await act(async () => initial.lifecycle.unmount()); }

    const unavailable = renderSlot({ component: NewChildThreadHandler }, {}, {
      sdk: { threads: { get: async () => ({ ...parent, archivedAt: 1 }) } },
      rpc: { childThreadPreferences: () => null },
    });
    try {
      await act(async () => { window.dispatchEvent(new window.CustomEvent(NEW_CHILD_THREAD_EVENT, { detail: parent.id })); });
      expect(window.document.querySelector('[role="alert"]')!.textContent).toContain("cannot start a child");
      expect(window.document.querySelector('[data-testid="bb-new-thread-composer"]')).toBeNull();
      expect(unavailable.inspection.sdkCalls.filter(call => call.method === "threads.spawn")).toHaveLength(0);
    } finally { await act(async () => unavailable.lifecycle.unmount()); }

  } finally {
    await window.happyDOM.close();
    for (const [key, descriptor] of Object.entries(before)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
