export const MemoryTurnCounter = async ({ client, $, directory, worktree }) => {
  const CONSOLIDATE_THRESHOLD = 10;

  function getSessionStoragePath(sessionId) {
    return `.agent-harness/memory/.turn_count_${sessionId}`;
  }

  async function loadTurnCount(sessionId) {
    const sessionFile = getSessionStoragePath(sessionId);
    try {
      const content = await $`cat ${sessionFile}`;
      const data = JSON.parse(content.stdout.trim());
      return data.count || 0;
    } catch {
      return 0;
    }
  }

  async function saveTurnCount(sessionId, count) {
    const sessionFile = getSessionStoragePath(sessionId);
    await $`echo ${JSON.stringify({ sessionId, count })} > ${sessionFile}`;
  }

  async function triggerConsolidate(sessionId) {
    const consolidateMsg = JSON.stringify({
      action: "consolidate",
      sessionId,
      triggeredAt: new Date().toISOString(),
    });
    await $`echo ${consolidateMsg} > .agent-harness/memory/.turn_count`;
  }

  let currentSessionId = null;
  let currentCount = 0;

  return {
    "session.created": async (input, output) => {
      const event = input.event || {};
      currentSessionId = event.sessionId || "default";
      currentCount = await loadTurnCount(currentSessionId);
      await client.app.log({
        body: {
          service: "memory-turn-counter",
          level: "info",
          message: `Session ${currentSessionId} started with turn count ${currentCount}`,
        },
      });
    },

    "tool.execute.after": async (input, output) => {
      if (!currentSessionId) {
        currentSessionId = "default";
        currentCount = await loadTurnCount(currentSessionId);
      }

      currentCount++;

      await saveTurnCount(currentSessionId, currentCount);

      await client.app.log({
        body: {
          service: "memory-turn-counter",
          level: "debug",
          message: `Tool executed: ${input.tool}, turns: ${currentCount}`,
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
    },
  };
};
