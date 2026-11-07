import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Snapshot } from "./contract";
const MAX_GOALS_LENGTH = 12000;
import { indentLines } from "./indentation";

export interface GoalsApi {
  read(): Promise<Snapshot>;
  save(text: string, expectedRevision: number, expectedWeek: string, expectedTimezone: string): Promise<Snapshot>;
}

export function GoalsEditor({ api }: { api: GoalsApi }) {
  const fieldId = useId();
  const [saved, setSaved] = useState<Snapshot | null>(null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const mounted = useRef(false);
  const latestText = useRef("");
  const field = useRef<HTMLTextAreaElement>(null);
  const selection = useRef<{ start: number; end: number; direction: "forward" | "backward" | "none" } | null>(null);
  useLayoutEffect(() => {
    if (!selection.current) return;
    const { start, end, direction } = selection.current;
    field.current?.setSelectionRange(start, end, direction);
    selection.current = null;
  }, [text]);
  const report = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    api.read().then(value => {
      if (!active) return;
      setSaved(value); setText(value.goals.text); latestText.current = value.goals.text;
    }, cause => { if (active) setError(report(cause)); });
    return () => { active = false; mounted.current = false; };
  }, [api]);

  async function reload() {
    setPending(true);
    try {
      const value = await api.read();
      if (!mounted.current) return;
      // Preserve the draft on conflicts; the saved version is shown for comparison.
      setSaved(value); setError(null);
      if (saved === null) {
        setText(value.goals.text); latestText.current = value.goals.text;
        setConflict(false); setNotice("");
      } else {
        setConflict(true);
        setNotice("Saved goals loaded below. Your draft is unchanged; compare before saving.");
      }
    } catch (cause) { if (mounted.current) setError(report(cause)); }
    finally { if (mounted.current) setPending(false); }
  }
  async function save() {
    if (!saved || !canSave) return;
    const submitted = text;
    setPending(true); setError(null); setNotice("");
    try {
      const value = await api.save(submitted, saved.goals.revision, saved.currentWeek, saved.timezone);
      if (!mounted.current) return;
      setSaved(value); setConflict(false);
      setNotice(latestText.current === submitted ? "Saved." : "Earlier text saved. Your latest edits are not saved yet.");
    } catch (cause) { if (mounted.current) setError(report(cause)); }
    finally { if (mounted.current) setPending(false); }
  }
  const dirty = saved !== null && text !== saved.goals.text;
  const canSave = !pending && saved !== null && (dirty || saved.stale || saved.goals.revision === 0);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  return <section className="wg-editor" aria-label="Weekly goals">
    <header>
      <h2>Goals for the week</h2>
      <p>{saved ? `Week of ${saved.currentWeek}` : "Loading goals…"}</p>
    </header>
    <p className="wg-hint">What would make this a good week? Include the outcome and any deadline.</p>
    {saved?.stale && <p role="status" className="wg-warning">These goals were saved for {saved.goals.weekOf} in {saved.goals.timezone}. Review them, then save for this week in {saved.timezone}.</p>}
    <label className="wg-sr-only" htmlFor={fieldId}>Your goals for the week</label>
    <textarea ref={field} id={fieldId} aria-label="Your goals for the week" aria-keyshortcuts="Meta+Enter Tab Shift+Tab"
      placeholder="Write your goals here…" value={text} maxLength={MAX_GOALS_LENGTH}
      onKeyDown={event => {
        if (event.key === "Tab" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.stopPropagation();
          const target = event.currentTarget;
          const result = indentLines(text, target.selectionStart, target.selectionEnd, event.shiftKey);
          if (result.text === text || result.text.length > MAX_GOALS_LENGTH) return;
          selection.current = { start: result.start, end: result.end, direction: target.selectionDirection };
          latestText.current = result.text;
          setText(result.text);
          setNotice("");
          return;
        }
        if (event.key !== "Enter" || !event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat && !event.nativeEvent.isComposing) void save();
      }}
      disabled={saved === null} onChange={event => {
        latestText.current = event.target.value; setText(event.target.value); setNotice("");
      }} />
    {error && <div role="alert" className="wg-error"><p>{error}</p>
      <button type="button" disabled={pending} onClick={() => void reload()}>Reload saved goals</button></div>}
    {conflict && saved && <details><summary>Saved version (your draft is above)</summary>
      <pre>{saved.goals.text || "No goals saved."}</pre>
      <button type="button" onClick={() => {
        setText(saved.goals.text); latestText.current = saved.goals.text;
        setConflict(false); setNotice("Loaded saved version.");
      }}>Use saved version</button>
    </details>}
    <div className="wg-save-row">
      <button type="button" className="wg-save" title="Save goals (⌘Enter)" disabled={!canSave}
        onClick={() => void save()}>{pending ? "Saving…" : saved?.stale ? "Save for this week" : "Save goals"}</button>
      <span role="status" aria-live="polite">{notice || (dirty ? "Unsaved changes" : saved?.goals.updatedAt ? "Saved" : "")}</span>
    </div>
    <p className="wg-footnote">{saved?.schedule || "Loading schedule…"}. Only saved goals are used.</p>
  </section>;
}
