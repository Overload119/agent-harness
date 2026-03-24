// Managed by agent-harness setup.

const MEMORY_COMMAND = ["bunx", "--bun", "@aitytech/agentkits-memory", "hook"];

const TOOL_NAME_MAP = {
  bash: "Bash",
  edit: "Edit",
  fetch: "WebFetch",
  glob: "Glob",
  grep: "Grep",
  read: "Read",
  skill: "Skill",
  task: "Task",
  webfetch: "WebFetch",
  websearch: "WebSearch",
  write: "Write",
};

function getSessionId(value) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value.sessionID || value.sessionId || value.session_id;
}

function getProperties(event) {
  if (!event || typeof event !== "object") {
    return {};
  }

  return event.properties && typeof event.properties === "object" ? event.properties : event;
}

function toToolName(tool) {
  if (typeof tool !== "string") {
    return "";
  }

  return TOOL_NAME_MAP[tool.toLowerCase()] || tool;
}

function normalizeToolInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const normalized = { ...input };

  if (typeof normalized.filePath === "string" && typeof normalized.file_path !== "string") {
    normalized.file_path = normalized.filePath;
  }

  if (typeof normalized.subagentType === "string" && typeof normalized.subagent_type !== "string") {
    normalized.subagent_type = normalized.subagentType;
  }

  return normalized;
}

function extractPrompt(properties) {
  if (!properties || typeof properties !== "object") {
    return "";
  }

  if (typeof properties.prompt === "string") {
    return properties.prompt;
  }

  if (typeof properties.text === "string") {
    return properties.text;
  }

  if (typeof properties.content === "string") {
    return properties.content;
  }

  const message = properties.message;
  if (message && typeof message === "object") {
    if (typeof message.content === "string") {
      return message.content;
    }

    if (Array.isArray(message.content)) {
      return message.content
        .map((part) => (part && typeof part === "object" && typeof part.text === "string" ? part.text : ""))
        .filter(Boolean)
        .join("
");
    }
  }

  return "";
}

function isUserMessage(properties) {
  if (!properties || typeof properties !== "object") {
    return false;
  }

  const directRole = typeof properties.role === "string" ? properties.role : undefined;
  const messageRole =
    properties.message && typeof properties.message === "object" && typeof properties.message.role === "string"
      ? properties.message.role
      : undefined;

  const role = directRole || messageRole;
  return role === "user";
}

async function runHook(directory, event, payload) {
  const child = Bun.spawn({
    cmd: [...MEMORY_COMMAND, event],
    cwd: directory,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
  });

  const stdin = JSON.stringify({ cwd: directory, ...payload });
  await child.stdin.write(stdin);
  await child.stdin.end();

  const stdout = await new Response(child.stdout).text();
  await child.exited;

  const lines = stdout
    .split(/?
/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = lines.at(-1);

  if (!lastLine) {
    return {};
  }

  try {
    return JSON.parse(lastLine);
  } catch {
    return {};
  }
}

export const AgentKitsMemoryPlugin = async ({ $, directory }) => {
  const lastPromptBySession = new Map();

  return {
    async "experimental.chat.system.transform"(input, output) {
      const result = await runHook(directory, "context", {
        session_id: getSessionId(input),
      });

      if (typeof result.additionalContext === "string" && result.additionalContext.trim() !== "") {
        output.system.push(result.additionalContext);
      }
    },

    async event({ event }) {
      const properties = getProperties(event);
      const sessionId = getSessionId(properties) || getSessionId(event);

      if (event.type === "message.updated" && sessionId && isUserMessage(properties)) {
        const prompt = extractPrompt(properties).trim();
        if (prompt !== "" && lastPromptBySession.get(sessionId) !== prompt) {
          lastPromptBySession.set(sessionId, prompt);
          await runHook(directory, "session-init", {
            prompt,
            session_id: sessionId,
          });
        }
      }

      if ((event.type === "session.idle" || event.type === "session.deleted") && sessionId) {
        await runHook(directory, "summarize", {
          session_id: sessionId,
          stop_reason: event.type,
        });
      }
    },

    async "tool.execute.after"(input, output) {
      await runHook(directory, "observation", {
        session_id: getSessionId(input),
        tool_input: normalizeToolInput(input?.args),
        tool_name: toToolName(input?.tool),
        tool_result: {
          metadata: output?.metadata,
          output: output?.output,
          title: output?.title,
        },
      });
    },
  };
};
