import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

export const questionSchema = z.object({
  threadId: z.string(),
  question: z.string().nullable(),
  createdAt: z.number(),
  status: z.string(),
  error: z.string().nullable(),
}).strict();
export type Question = z.infer<typeof questionSchema>;
export type QuestionsPage = { items: Question[]; nextOffset: number | null };
const chatTargetSchema = z.object({ sourceThreadId: z.string().min(1), threadId: z.string().min(1) }).strict();
const changedSchema = z.object({ changed: z.literal(true) }).strict();
export const questionsMethods = {
  questions: {
    experimental_description: "List a thread's side chats with their original questions. Follow nextOffset for more rows.",
    input: z.object({ sourceThreadId: z.string().min(1), offset: z.number().int().nonnegative().default(0) }).strict(),
    output: z.object({ items: z.array(questionSchema), nextOffset: z.number().nullable() }).strict(),
  },
  newQuestion: {
    experimental_description: "Create an idle hidden side chat inheriting the source thread's context. Returns threadId; send the question with the normal thread messaging API.",
    input: z.object({ sourceThreadId: z.string().min(1) }).strict(),
    output: questionSchema,
  },
  archiveQuestion: {
    experimental_description: "Archive one side chat belonging to the source thread, preserving its conversation.",
    input: chatTargetSchema, output: changedSchema,
  },
  restoreQuestion: {
    experimental_description: "Undo archival of one side chat belonging to an active source thread.",
    input: chatTargetSchema, output: changedSchema,
  },
};

type QuestionSdk = Pick<BbPluginApi["sdk"], "threads">;
type Thread = Awaited<ReturnType<QuestionSdk["threads"]["get"]>>;
type Input = Parameters<QuestionSdk["threads"]["send"]>[0]["input"];
const PAGE_SIZE = 20;

export function questionText(input: Input): string | null {
  const visible = input.filter(part => part.visibility !== "agent-only");
  if (visible.length === 0) return null;
  const text = visible.flatMap(part => part.type === "text" ? [part.text] : []).join("\n").trim();
  if (text) return text;
  return visible.some(part => part.type !== "text") ? "Question with attachment" : null;
}

// Read local request events, not the inherited transcript or the generated title.
// Filtering and ascending order keep the first question accessible after any
// number of follow-ups. Agent-only seed text is never a list label.
async function firstQuestion(sdk: QuestionSdk, threadId: string): Promise<string | null> {
  let afterSeq = "0";
  for (;;) {
    const events = await sdk.threads.events.list({ threadId, types: ["client/turn/requested"], order: "asc", afterSeq, limit: "20" });
    for (const event of events) {
      if (event.threadId !== threadId || event.type !== "client/turn/requested" || event.data.initiator !== "user") continue;
      const text = questionText(event.data.input);
      if (text !== null) return text;
    }
    if (events.length < 20) break;
    const next = String(events.at(-1)!.seq);
    if (next === afterSeq) throw new Error("Question history did not advance.");
    afterSeq = next;
  }
  const queued = await sdk.threads.queuedMessages.list({ threadId });
  for (const entry of [...queued].sort((a, b) => a.createdAt - b.createdAt)) {
    if (entry.initiator !== "user") continue;
    const text = questionText(entry.content);
    if (text !== null) return text;
  }
  return null;
}

function isSideChat(thread: Pick<Thread, "sourceThreadId" | "originKind" | "originPluginId" | "visibility" | "deletedAt">, sourceThreadId: string) {
  return thread.sourceThreadId === sourceThreadId && thread.originKind === "fork" &&
    ["agent-harness", "side-chats", "side-chat", "brain-shortcut"].includes(thread.originPluginId ?? "") &&
    thread.visibility === "hidden" && thread.deletedAt === null;
}

export async function setQuestionArchived(sdk: QuestionSdk, sourceThreadId: string, threadId: string, archived: boolean) {
  const thread = await sdk.threads.get({ threadId });
  if (threadId === sourceThreadId || !isSideChat(thread, sourceThreadId)) {
    throw new Error("This side chat does not belong to this thread.");
  }
  if (!archived) {
    const source = await sdk.threads.get({ threadId: sourceThreadId });
    if (source.archivedAt !== null || source.deletedAt !== null) {
      throw new Error("Restore the main thread before restoring this side chat.");
    }
  }
  if (archived && thread.archivedAt === null) await sdk.threads.archive({ threadId });
  if (!archived && thread.archivedAt !== null) await sdk.threads.unarchive({ threadId });
  return { changed: true as const };
}

export async function listQuestions(sdk: QuestionSdk, sourceThreadId: string, offset: number) {
  const threads = await sdk.threads.list({ sourceThreadId, originKind: "fork", includeHidden: true, archived: false, limit: PAGE_SIZE + 1, offset });
  const items = await Promise.all(threads.slice(0, PAGE_SIZE).filter(thread => isSideChat(thread, sourceThreadId) && thread.archivedAt === null).map(async thread => {
    let question: string | null = null;
    let error: string | null = null;
    try { question = await firstQuestion(sdk, thread.id); }
    catch { error = "Could not load this question."; }
    return { threadId: thread.id, question, createdAt: thread.createdAt, status: thread.runtime.displayStatus, error };
  }));
  return { items, nextOffset: threads.length > PAGE_SIZE ? offset + PAGE_SIZE : null };
}

export async function newQuestion(sdk: QuestionSdk, sourceThreadId: string): Promise<Question> {
  const source = await sdk.threads.get({ threadId: sourceThreadId });
  if (source.archivedAt !== null || source.deletedAt !== null || !source.environmentId) {
    throw new Error("Restore this thread and its workspace before starting a question.");
  }
  const thread = await sdk.threads.fork({ sourceThreadId, lifecycleOwnerThreadId: sourceThreadId, visibility: "hidden", title: "New chat" });
  return { threadId: thread.id, question: null, createdAt: thread.createdAt, status: thread.runtime.displayStatus, error: null };
}
