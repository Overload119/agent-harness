export type PrdTask = {
  id?: string;
  title?: string;
  passes?: boolean;
};

export type PrdDocument = {
  project?: string;
  branchName?: string;
  description?: string;
  tasks?: PrdTask[];
};

export type PrdCard = {
  branchName: string;
  description: string;
  fileName: string;
  invalidReason: string;
  lastModified: number;
  nextTask: string;
  project: string;
  status: "done" | "in_progress" | "planned" | "invalid";
  tasksDone: number;
  tasksTotal: number;
};

export function cardFromDocument(fileName: string, lastModified: number, document: PrdDocument): PrdCard {
  const tasks = Array.isArray(document.tasks) ? document.tasks : [];
  const tasksDone = tasks.filter((task) => task?.passes === true).length;
  const nextTask = tasks.find((task) => task?.passes !== true)?.title || "All tasks complete";
  const status =
    tasks.length === 0
      ? "planned"
      : tasksDone === tasks.length
        ? "done"
        : tasksDone > 0
          ? "in_progress"
          : "planned";

  return {
    branchName: document.branchName || "No branch name",
    description: document.description || "No description",
    fileName,
    invalidReason: "",
    lastModified,
    nextTask,
    project: document.project || "Unknown project",
    status,
    tasksDone,
    tasksTotal: tasks.length,
  };
}

export function invalidCard(fileName: string, lastModified: number, error: unknown): PrdCard {
  return {
    branchName: "Invalid JSON",
    description: "This file could not be parsed as a PRD document.",
    fileName,
    invalidReason: error instanceof Error ? error.message : "Unknown parse error",
    lastModified,
    nextTask: "Fix JSON format",
    project: "Unknown project",
    status: "invalid",
    tasksDone: 0,
    tasksTotal: 0,
  };
}
