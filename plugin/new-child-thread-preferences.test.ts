import { expect, test } from "bun:test";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "../server";

test("preferences persist globally across plugin reloads and reject invalid values", async () => {
  let { bb, harness } = createFakePluginHost({ pluginId: "agent-harness" });
  try {
    await plugin(bb);
    expect(await harness.behavior.callRpc("childThreadPreferences", {})).toBeNull();
    await bb.storage.kv.set("child-thread-preferences", { providerId: "codex", parentNotifications: "stuck" });
    expect(await harness.behavior.callRpc("childThreadPreferences", {})).toEqual({ providerId: "codex", parentNotifications: "stuck", stayOnCurrentPage: false });
    const options = { providerId: "claude-code", parentNotifications: "off", stayOnCurrentPage: true };
    await harness.behavior.callRpc("saveChildThreadPreferences", options);
    ({ bb, harness } = await harness.lifecycle.reload(plugin));
    expect(await harness.behavior.callRpc("childThreadPreferences", {})).toEqual(options);
    await expect(harness.behavior.callRpc("saveChildThreadPreferences", { ...options, parentNotifications: "invalid" })).rejects.toThrow();
    await expect(harness.behavior.callRpc("saveChildThreadPreferences", { ...options, providerId: "" })).rejects.toThrow();
    await expect(harness.behavior.callRpc("saveChildThreadPreferences", { ...options, hostId: "devbox-only" })).rejects.toThrow();
    expect(await harness.behavior.callRpc("childThreadPreferences", {})).toEqual(options);
    await harness.behavior.callRpc("saveChildThreadPreferences", { providerId: "codex", parentNotifications: "stuck" });
    expect(await harness.behavior.callRpc("childThreadPreferences", {})).toEqual({ providerId: "codex", parentNotifications: "stuck", stayOnCurrentPage: false });
    await expect(harness.behavior.callRpc("saveChildThreadPreferences", { ...options, stayOnCurrentPage: "true" })).rejects.toThrow();
  } finally {
    await harness.lifecycle.dispose();
  }
});
