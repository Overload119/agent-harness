import { useEffect, useMemo, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../../server";
import { GoalsEditor } from "./editor";

export function useGoalsVisible(threadId: string) {
  const rpc = useRpc<typeof rpcContract>();
  const [target, setTarget] = useState("");
  useEffect(() => {
    let active = true;
    const read = () => rpc.call("setupRead", {}).then(state => {
      if (active) setTarget(state.configuration.enabled ? state.configuration.targetThreadId : "");
    }, () => { if (active) setTarget(""); });
    void read();
    window.addEventListener("focus", read);
    const timer = setInterval(read, 5000);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", read); };
  }, [rpc, threadId]);
  return target === threadId;
}
export function GoalsPanel({ threadId }: { threadId: string }) {
  const rpc = useRpc<typeof rpcContract>();
  const api = useMemo(() => ({ read: () => rpc.call("goalsRead", { threadId }),
    save: (text: string, expectedRevision: number, expectedWeek: string, expectedTimezone: string) => rpc.call("goalsSave", { threadId, text, expectedRevision, expectedWeek, expectedTimezone }),
  }), [rpc, threadId]);
  return <GoalsEditor key={threadId} api={api} />;
}
