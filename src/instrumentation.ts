// src/instrumentation.ts — Next.js instrumentation hook (runs once on server start)
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run cron jobs on self-hosted (Railway) — on Vercel, use vercel.json crons
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { startCronJobs } = await import("@/lib/cron-jobs");
    startCronJobs();
  }
}
