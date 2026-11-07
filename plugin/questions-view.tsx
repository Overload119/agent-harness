import { useEffect, useRef, useState } from "react";
import { ThreadChat, useRpc, useSdk } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { rpcContract } from "../server";
import type { Question, QuestionsPage } from "./questions";

const errorText = (cause: unknown) => cause instanceof Error ? cause.message : "Could not update side chats.";
const startedFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fullStartedFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "long" });

// A source switch must discard selection, request generations and loading state.
export function QuestionsPanel({ threadId }: { threadId: string }) {
  return <Questions key={threadId} sourceThreadId={threadId} />;
}

export function Questions({ sourceThreadId }: { sourceThreadId: string }) {
  const rpc = useRpc<typeof rpcContract>();
  const sdk = useSdk();
  const [items, setItems] = useState<Question[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState<string | null>(null);
  const archivePending = useRef(false);
  const restoring = useRef(new Set<string>());
  const currentItems = useRef(items);
  currentItems.current = items;
  const pending = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      if (cancelled || running) return;
      clearTimeout(timer);
      running = true;
      const started = generation.current;
      try {
        const loaded = new Map<string, Question>();
        let offset: number | null = 0;
        for (let page = 0; page < pageCount && offset !== null; page++) {
          const result: QuestionsPage = await rpc.call("questions", { sourceThreadId, offset });
          if (cancelled || started !== generation.current) return;
          for (const item of result.items) loaded.set(item.threadId, item);
          offset = result.nextOffset;
        }
        const next = [...loaded.values()].sort((a, b) => b.createdAt - a.createdAt || a.threadId.localeCompare(b.threadId));
        setItems(next);
        setHasMore(offset !== null);
        // A chat can move beyond the loaded page while other chats are active.
        // Refreshing the list must never switch away from an open draft.
        setSelected(current => current ?? next[0]?.threadId ?? null);
        setError(null);
      } catch (cause) {
        if (!cancelled && started === generation.current) setError(errorText(cause));
      } finally {
        running = false;
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(() => void refresh(), 5_000);
        }
      }
    }
    setLoading(true);
    void refresh();
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener("focus", focus); };
  }, [rpc, sourceThreadId, pageCount, refreshKey]);

  async function create() {
    if (pending.current) return;
    pending.current = true;
    setCreating(true);
    setError(null);
    try {
      const item = await rpc.call("newQuestion", { sourceThreadId });
      if (!mounted.current) return;
      generation.current++;
      setItems(current => [item, ...(current ?? []).filter(other => other.threadId !== item.threadId)]);
      setSelected(item.threadId);
      setRefreshKey(key => key + 1);
    } catch (cause) {
      if (mounted.current) setError(errorText(cause));
    } finally {
      pending.current = false;
      if (mounted.current) setCreating(false);
    }
  }

  async function restore(item: Question) {
    if (restoring.current.has(item.threadId)) return;
    restoring.current.add(item.threadId);
    try {
      await rpc.call("restoreQuestion", { sourceThreadId, threadId: item.threadId });
      if (mounted.current) {
        generation.current++;
        setItems(current => [item, ...(current ?? []).filter(other => other.threadId !== item.threadId)]
          .sort((a, b) => b.createdAt - a.createdAt || a.threadId.localeCompare(b.threadId)));
        setSelected(current => current ?? item.threadId);
        setRefreshKey(key => key + 1);
      }
      toast.success("Side chat restored");
    } catch (cause) { toast.error(errorText(cause)); }
    finally { restoring.current.delete(item.threadId); }
  }

  async function archive(item: Question) {
    if (archivePending.current) return;
    archivePending.current = true;
    setArchiving(item.threadId);
    try {
      await rpc.call("archiveQuestion", { sourceThreadId, threadId: item.threadId });
      if (mounted.current) {
        generation.current++;
        setItems(current => (current ?? []).filter(other => other.threadId !== item.threadId));
        setSelected(current => current === item.threadId
          ? currentItems.current?.find(other => other.threadId !== item.threadId)?.threadId ?? null
          : current);
        setRefreshKey(key => key + 1);
      }
      toast.success("Side chat archived", {
        duration: 10_000,
        action: { label: "Undo", onClick: () => void restore(item) },
      });
    } catch (cause) { toast.error(errorText(cause)); }
    finally {
      archivePending.current = false;
      if (mounted.current) setArchiving(null);
    }
  }

  return <div className="questions-panel">
    <div className="questions-toolbar">
      <span className="questions-heading">Side chats</span>
      <button type="button" onClick={() => void create()} disabled={creating}>
        {creating ? "Starting…" : "+ New chat"}
      </button>
    </div>
    {error && <div className="questions-error" role="alert">
      {error} <button type="button" onClick={() => setRefreshKey(key => key + 1)}>Refresh</button>
    </div>}
    {items === null && !error && <p className="questions-empty" role="status">Loading side chats…</p>}
    {items?.length === 0 && <p className="questions-empty">Start a side chat about this thread.</p>}
    <Tooltip.Provider delayDuration={300}>
      <nav className="questions-list" aria-label="Side chats">
        {items?.map(item => <div key={item.threadId} className="questions-row"
          data-selected={selected === item.threadId ? "true" : undefined}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button type="button" className="questions-open"
                aria-current={selected === item.threadId ? "true" : undefined}
                onClick={() => setSelected(item.threadId)}>
                <span className="questions-label">{item.question ?? item.error ?? "New chat"}</span>
                <span className="questions-meta">
                  <time dateTime={new Date(item.createdAt).toISOString()}
                    title={`Started ${fullStartedFormat.format(item.createdAt)}`}
                    aria-label={`Started ${fullStartedFormat.format(item.createdAt)}`}>
                    {startedFormat.format(item.createdAt)}
                  </time>
                  {item.status !== "idle" && <span>{item.status.replaceAll("-", " ")}</span>}
                </span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="questions-tooltip" side="bottom" align="start" sideOffset={6} collisionPadding={12}>
                {item.question ?? item.error ?? "New chat"}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
          <button type="button" className="questions-archive" title="Archive chat"
            aria-label={`Archive chat: ${item.question ?? "New chat"}`} disabled={archiving !== null}
            onClick={() => void archive(item)}>{archiving === item.threadId ? "…" : "×"}</button>
        </div>)}
        {hasMore && <button type="button" className="questions-more" disabled={loading}
          onClick={() => setPageCount(count => count + 1)}>{loading ? "Loading…" : "Show more"}</button>}
      </nav>
    </Tooltip.Provider>
    {selected && <ThreadChat key={selected} threadId={selected} variant="compact" layout="contained"
      permissionPolicy="editable" className="questions-chat" focusRequest={1}
      messageActions={[{
        id: "send-to-main", title: "Send to main thread", icon: "ArrowTurnBackward", roles: ["assistant"],
        run: async message => {
          const text = message.text.trim();
          if (!text) return;
          try {
            await sdk.threads.queuedMessages.create({ threadId: sourceThreadId, senderThreadId: selected,
              input: [{ type: "text", text, mentions: [] }] });
            toast.success("Sent to main thread");
          } catch (cause) { toast.error(errorText(cause)); }
        },
      }]} />}
  </div>;
}
