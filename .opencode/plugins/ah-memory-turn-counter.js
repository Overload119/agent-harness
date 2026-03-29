export const MemoryTurnCounter = async ({ client, $, directory, worktree }) => {
  const CONSOLIDATE_THRESHOLD = 6;
  const baseDir = directory || process.cwd();

  function getSessionStoragePath(sessionId) {
    return `${baseDir}/.agent-harness/memory/.turn_count_${sessionId}`;
  }

  async function loadTurnCount(sessionId) {
    const sessionFile = getSessionStoragePath(sessionId);
    const content = await $`cat "${sessionFile}"`.nothrow().quiet();
    const text = await content.text();
    if (!text.trim()) {
      return 0;
    }
    const data = JSON.parse(text.trim());
    return data.count || 0;
  }

  async function saveTurnCount(sessionId, count) {
    const sessionFile = getSessionStoragePath(sessionId);
    await $`mkdir -p "${baseDir}/.agent-harness/memory"`;
    await $`echo "${JSON.stringify({ sessionId, count })}" > "${sessionFile}"`
  }

  async function triggerConsolidate(sessionId) {
    const consolidateMsg = JSON.stringify({
      action: "consolidate",
      sessionId,
      triggeredAt: new Date().toISOString(),
    });
    await $`mkdir -p "${baseDir}/.agent-harness/memory"`;
    await $`echo "${consolidateMsg}" > "${baseDir}/.agent-harness/memory/.turn_count"`;
  }

  let currentSessionId = null;
  let currentCount = 0;

  return {
    event: async ({ event }) => {
      if (event.type === "session.created") {
        currentSessionId = event.properties?.sessionID || "default";
        currentCount = await loadTurnCount(currentSessionId);
        await client.app.log({
          body: {
            service: "memory-turn-counter",
            level: "info",
            message: `Session ${currentSessionId} started with turn count ${currentCount}`,
          },
        });
      }
    },

    "chat.message": async (input) => {
      if (!currentSessionId) {
        currentSessionId = input.sessionID || "default";
        currentCount = await loadTurnCount(currentSessionId);
      }

      if (input.message?.role === "user") {
        currentCount++;

        await saveTurnCount(currentSessionId, currentCount);

        await client.app.log({
          body: {
            service: "memory-turn-counter",
            level: "debug",
            message: `User message received, messages: ${currentCount}`,
          },
        });

        if (currentCount >= CONSOLIDATE_THRESHOLD) {
          await client.app.log({
            body: {
              service: "memory-turn-counter",
              level: "info",
              message: `Threshold reached (${currentCount}), triggering consolidation`,
            },
          });
          await triggerConsolidate(currentSessionId);
          currentCount = 0;
          await saveTurnCount(currentSessionId, currentCount);
        }
      }
    },
  };
};
