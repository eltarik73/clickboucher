// src/instrumentation.ts — Next.js instrumentation hook (runs once on server start)
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run cron jobs on the server (not during build or on edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronJobs } = await import("@/lib/cron-jobs");
    startCronJobs();
  }
}
