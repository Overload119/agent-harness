import { z } from "zod";

const id = z.string().min(1).max(200);
export const timezoneSchema = z.string().max(100).refine(value => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
}, "Choose a valid IANA timezone, such as Europe/London.");
export const configurationSchema = z.object({
  enabled: z.boolean(),
  sideChats: z.boolean(),
  standingInstructions: z.boolean(),
  projectId: z.string().max(200),
  environmentId: z.string().max(200),
  targetThreadId: z.string().max(200), // Empty means create a dedicated idle thread.
  timezone: timezoneSchema,
  schedule: z.object({ enabled: z.boolean(), cron: z.string().min(1).max(100) }).strict(),
  execution: z.object({
    providerId: z.string().max(200), model: z.string().max(200),
    reasoning: z.string().max(100), permissionMode: z.enum(["accept-edits", "auto", "full"]),
  }).strict(),
  sources: z.object({
    bbProjectIds: z.array(id).max(100),
    gitlab: z.object({ host: z.string().max(200), repositories: z.array(z.string().min(1).max(200)).max(30) }).strict().nullable(),
    slack: z.object({ workspace: z.string().min(1).max(200), channels: z.array(z.string().min(1).max(200)).max(30) }).strict().nullable(),
    guidance: z.string().max(4000),
  }).strict(),
}).strict();
export type Configuration = z.infer<typeof configurationSchema>;
export function defaultConfiguration(): Configuration {
  return { enabled: false, sideChats: true, standingInstructions: true, projectId: "", environmentId: "", targetThreadId: "",
    timezone: "UTC", schedule: { enabled: false, cron: "0 9,13 * * 1-5" },
    execution: { providerId: "", model: "", reasoning: "", permissionMode: "auto" },
    sources: { bbProjectIds: [], gitlab: null, slack: null, guidance: "" } };
}
export const setupStateSchema = z.object({
  revision: z.number().int().nonnegative(), configuration: configurationSchema,
  automationId: z.string().nullable(), automationProjectId: z.string().nullable(),
  pending: z.boolean(), error: z.string().nullable(),
});
export type SetupState = z.infer<typeof setupStateSchema>;
export const setupInputSchema = z.object({ expectedRevision: z.number().int().nonnegative(), configuration: configurationSchema }).strict();
export type SetupInput = z.infer<typeof setupInputSchema>;
export const optionSchema = z.object({ id: z.string(), label: z.string() });
export const optionsSchema = z.object({ projects: z.array(optionSchema), environments: z.array(optionSchema), threads: z.array(optionSchema.extend({ environmentId: z.string().nullable() })), providers: z.array(optionSchema), truncated: z.boolean() });
export type SetupOptions = z.infer<typeof optionsSchema>;
export const goalSchema = z.object({ threadId: id, text: z.string().max(12000), weekOf: z.string().nullable(), timezone: z.string(), revision: z.number().int().nonnegative(), updatedAt: z.string().nullable() });
export type Goal = z.infer<typeof goalSchema>;
export const snapshotSchema = z.object({ setupRevision: z.number().int().nonnegative(), goals: goalSchema, currentWeek: z.string(), timezone: timezoneSchema, stale: z.boolean(), schedule: z.string(), configuration: configurationSchema });
export type Snapshot = z.infer<typeof snapshotSchema>;
export const saveGoalSchema = z.object({ threadId: id, text: z.string().max(12000), expectedRevision: z.number().int().nonnegative(), expectedWeek: z.string(), expectedTimezone: timezoneSchema }).strict();
export const methods = {
  setupRead: { input: z.object({}).strict(), output: setupStateSchema },
  setupOptions: { input: z.object({ projectId: z.string().optional() }).strict(), output: optionsSchema },
  setupPreview: { input: setupInputSchema, output: z.object({ summary: z.array(z.string()), configuration: configurationSchema }) },
  setupApply: { input: setupInputSchema, output: setupStateSchema },
  goalsRead: { input: z.object({ threadId: id }).strict(), output: snapshotSchema },
  goalsSave: { input: saveGoalSchema, output: snapshotSchema },
};
export function weekOf(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  const date = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
