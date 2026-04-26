# Database Connection — Vercel + Railway pgbouncer

## Why two URLs?

On Vercel, every cold-started serverless function opens a brand-new
PostgreSQL connection. With a small Railway/Supabase pool (typically 20–50
connections), traffic spikes saturate the pool in seconds and requests start
to time out. The fix is to put **pgbouncer** in front of Postgres so all
serverless functions multiplex through a single pooled connection.

`DATABASE_URL` (runtime, pgbouncer):
```
postgresql://user:password@host:6543/klikgo?pgbouncer=true&connection_limit=1
```

`DIRECT_DATABASE_URL` (migrations only — no pgbouncer):
```
postgresql://user:password@host:5432/klikgo
```

`prisma migrate deploy` needs `directUrl` because pgbouncer's transaction
pooling mode breaks advisory locks and DDL. Prisma reads `directUrl` from
`schema.prisma` at migration time only.

## Vercel setup

Both env vars must be configured in **Production**, **Preview**, and
**Development** environments via the Vercel dashboard (or `vercel env add`).
**Do not commit real values to git.**

## Local dev

You can set both URLs to the same plain Postgres URL — pgbouncer is not
required for a single dev process.
