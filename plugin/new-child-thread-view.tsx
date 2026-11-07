import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { experimental_NewThreadComposer as NewThreadComposer, type NewThreadRequest, useBbNavigate, useRpc, useSdk } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../server";
import { NEW_CHILD_THREAD_EVENT, checkChildParent, spawnChildThread, type ChildParent, type ChildThreadSdk, type ChildThreadOptions } from "./new-child-thread";

export type ChildPreferences = {
  load(): Promise<ChildThreadOptions | null>;
  save(options: ChildThreadOptions): Promise<unknown>;
};

const notificationDescriptions = {
  auto: "Notify the parent when the child finishes, fails, is interrupted, or needs help.",
  stuck: "Notify the parent only on failure, interruption, or when the child needs help.",
  off: "Do not send automatic notifications to the parent.",
};

const errorText = (cause: unknown) => cause instanceof Error ? cause.message : "Could not create the child thread.";

export function NewChildThreadDialog({ threadId, sdk, preferences, onClose, onCreated }: {
  threadId: string;
  sdk: ChildThreadSdk;
  preferences: ChildPreferences;
  onClose(): void;
  onCreated(threadId: string, preferencesSaved: boolean, stayOnCurrentPage: boolean): void;
}) {
  const [parent, setParent] = useState<ChildParent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [parentNotifications, setParentNotifications] = useState<ChildThreadOptions["parentNotifications"]>("auto");
  const [stayOnCurrentPage, setStayOnCurrentPage] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void Promise.all([
      sdk.threads.get({ threadId, signal: controller.signal }),
      preferences.load(),
    ]).then(([value, saved]) => {
      if (controller.signal.aborted) return;
      checkChildParent(value);
      setProviderId(saved?.providerId ?? null);
      setParentNotifications(saved?.parentNotifications ?? "auto");
      setStayOnCurrentPage(saved?.stayOnCurrentPage ?? false);
      setParent(value);
    }).catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)); });
    return () => { mounted.current = false; controller.abort(); };
  }, [sdk, threadId, preferences]);

  async function submit(request: NewThreadRequest) {
    // Reject instead of resolving: the native composer clears its draft only
    // after a successful onSubmit.
    if (pending.current || !parent) throw new Error("Child thread creation is not ready.");
    pending.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const options = { providerId: request.providerId, parentNotifications, stayOnCurrentPage };
      const child = await spawnChildThread(sdk, parent, request, options);
      // A preference-write failure must never turn a successful creation into
      // a retryable form: retrying would create a second child.
      let preferencesSaved = true;
      try { await preferences.save(options); } catch { preferencesSaved = false; }
      if (mounted.current) onCreated(child.id, preferencesSaved, stayOnCurrentPage);
    } catch (cause) {
      if (mounted.current) setError(errorText(cause));
      throw cause;
    } finally {
      pending.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  return <Dialog.Root open onOpenChange={open => { if (!open && !pending.current) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="ah-child-thread-backdrop" />
      <Dialog.Content className="ah-child-thread-dialog" onOpenAutoFocus={event => event.preventDefault()}
        onEscapeKeyDown={event => { if (pending.current) event.preventDefault(); }}
        onInteractOutside={event => event.preventDefault()}>
        <Dialog.Title className="ah-child-thread-title">New Child Thread</Dialog.Title>
        <Dialog.Description className="ah-child-thread-description">
          {parent ? <>Parent: <strong>{parent.title || parent.id}</strong><br />Uses the same project and workspace.</> : error ? "Could not load this dialog." : "Loading parent and saved settings…"}
        </Dialog.Description>
        <div className="ah-child-thread-options">
          <div>
            <label htmlFor="ah-child-thread-notifications">Notify parent</label>
            <select id="ah-child-thread-notifications" value={parentNotifications} disabled={submitting || !parent}
              aria-describedby="ah-child-thread-notification-description" onChange={event => {
                const value = event.target.value;
                if (value === "auto" || value === "stuck" || value === "off") setParentNotifications(value);
              }}>
              <option value="auto">All updates</option>
              <option value="stuck">Only when stuck</option>
              <option value="off">Off</option>
            </select>
          </div>
        </div>
        <p id="ah-child-thread-notification-description" className="ah-child-thread-description">{notificationDescriptions[parentNotifications]}</p>
        <label className="ah-child-thread-stay">
          <input type="checkbox" checked={stayOnCurrentPage} disabled={submitting || !parent}
            onChange={event => setStayOnCurrentPage(event.target.checked)} />
          Stay on current page
        </label>
        {error && <p role="alert" className="ah-child-thread-error">{error}</p>}
        {parent && <NewThreadComposer
          defaultProjectId={parent.projectId}
          defaultProviderId={providerId ?? parent.providerId}
          defaultEnvironment={{ type: "reuse", environmentId: parent.environmentId! }}
          draftKey={`agent-harness:child:${parent.id}`}
          placeholder="What should the child thread do?"
          layout="document"
          focusRequest={1}
          onSubmit={submit}
        />}
        <div className="ah-child-thread-buttons">
          <button type="button" disabled={submitting} onClick={onClose}>Cancel</button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function NewChildThreadHandler() {
  const sdk = useSdk();
  const navigate = useBbNavigate();
  const rpc = useRpc<typeof rpcContract>();
  const preferences = useMemo<ChildPreferences>(() => ({
    load: () => rpc.call("childThreadPreferences", {}),
    save: options => rpc.call("saveChildThreadPreferences", options),
  }), [rpc]);
  const [threadId, setThreadId] = useState<string | null>(null);
  useEffect(() => {
    const open = (event: Event) => {
      const id: unknown = (event as CustomEvent).detail;
      if (typeof id === "string" && id) setThreadId(current => current ?? id);
    };
    window.addEventListener(NEW_CHILD_THREAD_EVENT, open);
    return () => window.removeEventListener(NEW_CHILD_THREAD_EVENT, open);
  }, []);
  return threadId && <NewChildThreadDialog key={threadId} threadId={threadId} sdk={sdk} preferences={preferences}
    onClose={() => setThreadId(null)} onCreated={(id, preferencesSaved, stayOnCurrentPage) => {
      setThreadId(null);
      if (!stayOnCurrentPage) navigate.toThread(id);
      else if (preferencesSaved) toast.success("Child thread created.");
      if (!preferencesSaved) toast.error("Child thread created, but your settings could not be saved.");
    }} />;
}
