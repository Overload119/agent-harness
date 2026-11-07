import type { NewThreadRequest } from "@get-bb/plugin-sdk/app";
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

export type ChildThreadSdk = { threads: Pick<BbPluginApi["sdk"]["threads"], "get" | "spawn"> };
export type ChildParent = Awaited<ReturnType<ChildThreadSdk["threads"]["get"]>>;
export const childThreadOptionsSchema = z.object({
  providerId: z.string().trim().min(1).max(200),
  parentNotifications: z.enum(["auto", "stuck", "off"]),
  stayOnCurrentPage: z.boolean().default(false),
}).strict();
export type ChildThreadOptions = z.infer<typeof childThreadOptionsSchema>;

export const childThreadMethods = {
  childThreadPreferences: { input: z.object({}).strict(), output: childThreadOptionsSchema.nullable() },
  saveChildThreadPreferences: { input: childThreadOptionsSchema, output: z.object({ saved: z.literal(true) }).strict() },
};

export const NEW_CHILD_THREAD_EVENT = "agent-harness:new-child-thread";

export function requestNewChildThread(threadId: string) {
  window.dispatchEvent(new CustomEvent(NEW_CHILD_THREAD_EVENT, { detail: threadId }));
}

export function checkChildParent(parent: ChildParent) {
  if (!parent.canSpawnChild || parent.archivedAt !== null || parent.deletedAt !== null || !parent.environmentId) {
    throw new Error("This thread cannot start a child. Restore its workspace and unarchive it first.");
  }
}

export async function spawnChildThread(sdk: ChildThreadSdk, parent: ChildParent, request: NewThreadRequest, options: Pick<ChildThreadOptions, "parentNotifications">) {
  if (!request.input.some(part => part.type !== "text" || part.text.trim())) {
    throw new Error("Enter a prompt or attach a file for the child thread.");
  }
  if (!request.providerId.trim()) throw new Error("Select a harness for the child thread.");
  if (request.projectId !== parent.projectId || request.environment.type !== "reuse" || request.environment.environmentId !== parent.environmentId) {
    throw new Error("Child threads must use the parent's project and workspace. Select them in the composer before sending.");
  }
  // Recheck before creation: the parent may have moved or been archived while
  // its dialog was open. Do not silently switch the destination workspace.
  const current = await sdk.threads.get({ threadId: parent.id });
  checkChildParent(current);
  if (current.environmentId !== parent.environmentId || current.providerId !== parent.providerId || current.projectId !== parent.projectId) {
    throw new Error("The parent's workspace or provider changed. Reopen New Child Thread to use its current settings.");
  }
  return sdk.threads.spawn({
    ...request,
    parentThreadId: current.id,
    parentNotifications: options.parentNotifications,
  });
}
