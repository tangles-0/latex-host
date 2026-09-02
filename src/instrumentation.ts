export async function register(): Promise<void> {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_MODE === "true"
  ) {
    const { startNodeHeartbeat } = await import("@/lib/node-heartbeat");
    const { recoverNodeImportQueue } = await import("@/lib/node-imports");
    startNodeHeartbeat();
    await recoverNodeImportQueue();
  }
}
