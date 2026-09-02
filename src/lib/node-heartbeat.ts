import { pingLatexCloud } from "@/lib/self-hosted-nodes";

const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000;

const globalForHeartbeat = globalThis as unknown as {
  latexNodeHeartbeat?: NodeJS.Timeout;
};

const runHeartbeat = async (): Promise<void> => {
  try {
    await pingLatexCloud();
  } catch (error) {
    console.error("Self-hosted node heartbeat failed", error);
  }
};

export const startNodeHeartbeat = (): void => {
  if (globalForHeartbeat.latexNodeHeartbeat) {
    return;
  }
  const timer = setInterval(() => {
    void runHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
  timer.unref();
  globalForHeartbeat.latexNodeHeartbeat = timer;
  setTimeout(() => {
    void runHeartbeat();
  }, 10_000).unref();
};
