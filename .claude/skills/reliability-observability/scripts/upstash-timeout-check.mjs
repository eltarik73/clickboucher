// Proves, on this machine, how the installed @upstash/redis and @upstash/ratelimit behave when Redis
// is unreachable or silent. Read-only: talks to 127.0.0.1 only (a closed port and a local server
// that never answers), never to Upstash, never to the project's Redis.
// Usage (from the repository root): node .claude/skills/reliability-observability/scripts/upstash-timeout-check.mjs
// Exit code 0 when every expectation of the skill holds, 1 otherwise. Takes about 7 seconds.
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { Redis } = require("@upstash/redis");
const { Ratelimit } = require("@upstash/ratelimit");

const CLOSED = "http://127.0.0.1:9"; // discard port: connection refused at once
const silent = http.createServer(() => {}); // accepts the request, never answers
await new Promise((resolve) => silent.listen(0, "127.0.0.1", resolve));
const SILENT = `http://127.0.0.1:${silent.address().port}`;

const results = [];
function record(label, ok, detail) {
  results.push(ok);
  console.log(`${ok ? "OK  " : "FAIL"} ${label} — ${detail}`);
}
async function timed(run) {
  const started = Date.now();
  try {
    return { value: await run(), ms: Date.now() - started };
  } catch (error) {
    return { error, ms: Date.now() - started };
  }
}

// 1. SDK defaults against a refused connection: 5 retries, exp(i) * 50 ms of backoff between them.
{
  const redis = new Redis({ url: CLOSED, token: "x" });
  const r = await timed(() => redis.get("k"));
  record("défauts, connexion refusée", Boolean(r.error) && r.ms > 3_500 && r.ms < 6_000, `lève après ${r.ms} ms (attendu ≈ 4 300)`);
}

const bounded = { retry: { retries: 1, backoff: () => 50 }, signal: () => AbortSignal.timeout(800) };

// 2. Target options against a refused connection: two tries, 50 ms apart.
{
  const redis = new Redis({ url: CLOSED, token: "x", ...bounded });
  const r = await timed(() => redis.get("k"));
  record("cible, connexion refusée", Boolean(r.error) && r.ms < 500, `lève après ${r.ms} ms`);
}

// 3. Target options against a server that never answers: the command throws at the signal's deadline.
{
  const redis = new Redis({ url: SILENT, token: "x", ...bounded });
  const r = await timed(() => redis.get("k"));
  record("cible, serveur muet", r.error?.name === "TimeoutError" && r.ms >= 700 && r.ms < 1_500, `${r.error?.name} après ${r.ms} ms (attendu ≈ 800)`);
}

// 4. Rate limiter alone (no signal on the client): lets the request through at its own timeout.
{
  const redis = new Redis({ url: SILENT, token: "x", retry: { retries: 0 } });
  const limiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "60 s"), timeout: 1_000, analytics: false });
  const r = await timed(() => limiter.limit("id"));
  record("ratelimit timeout 1 000, serveur muet", r.value?.success === true && r.value?.reason === "timeout", `success=${r.value?.success} reason=${r.value?.reason} après ${r.ms} ms`);
}

// 5. Static signal that has already expired: no command ever works again on that client.
{
  const expired = AbortSignal.timeout(10);
  await new Promise((resolve) => setTimeout(resolve, 40));
  const redis = new Redis({ url: SILENT, token: "x", signal: expired });
  const r = await timed(() => redis.get("k"));
  const broken = Boolean(r.error) || r.value === null;
  record("signal statique expiré", broken && r.ms < 200, r.error ? `lève ${r.error.name}: ${r.error.message}` : `renvoie ${JSON.stringify(r.value)} sans appeler Redis`);
}

silent.closeAllConnections?.();
silent.close();
process.exit(results.every(Boolean) ? 0 : 1);
