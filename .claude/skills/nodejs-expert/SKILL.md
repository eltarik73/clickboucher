---
name: nodejs-expert
user_invocable: false
description: Patterns Node.js avances pour Klik&Go. Event loop, streams, clustering, modules, error handling, et performance. Utiliser pour le backend, les API routes, et les services Node.
---

# Node.js Expert — Backend Patterns & Performance

## Architecture Node.js

- **V8** : moteur JavaScript (compile JIT vers machine code)
- **libuv** : fournit l'event loop, async I/O, thread pool
- **Event loop single-threaded** : mais V8 peut utiliser des worker threads
- **Module wrapper** : chaque fichier est wrappe dans `(function(exports, require, module, __filename, __dirname) { ... })`

## Event Loop — Phases

```
   ┌───────────────────────────┐
┌──│           timers          │ ← setTimeout, setInterval
│  └───────────────────────────┘
│  ┌───────────────────────────┐
│  │     pending callbacks     │ ← I/O callbacks reportes
│  └───────────────────────────┘
│  ┌───────────────────────────┐
│  │       idle, prepare       │ ← usage interne
│  └───────────────────────────┘
│  ┌───────────────────────────┐
│  │           poll            │ ← I/O entrant, connections
│  └───────────────────────────┘
│  ┌───────────────────────────┐
│  │           check           │ ← setImmediate
│  └───────────────────────────┘
│  ┌───────────────────────────┐
└──│      close callbacks      │ ← socket.on('close')
   └───────────────────────────┘
```

### Ordre d'execution
1. Code synchrone (call stack)
2. `process.nextTick()` (avant toute autre async)
3. Microtasks (Promise.then, queueMicrotask)
4. Macrotasks (setTimeout, setInterval, setImmediate, I/O)

**Regle Klik&Go** : `process.nextTick()` pour les callbacks critiques, `setImmediate()` pour les taches non-urgentes apres I/O.

## Modules & Imports

```javascript
// CommonJS (Node traditionnel)
const express = require('express');
module.exports = { myFunction };

// ESM (Next.js / modern Node)
import express from 'express';
export { myFunction };

// require.cache — cache les modules requis
// Pour forcer le rechargement (tests) : delete require.cache[modulePath]

// __filename — chemin absolu du fichier courant
// __dirname — repertoire du fichier courant
```

## Streams (lecture/ecriture efficaces)

```javascript
// 4 types : Readable, Writable, Duplex, Transform
// process.stdout est un Writable stream
// process.stdin est un Readable stream

// Lire un gros fichier sans charger en memoire
const readStream = fs.createReadStream('huge-file.csv');
readStream.pipe(transformStream).pipe(writeStream);

// Pattern pipeline (moderne, avec gestion d'erreurs)
const { pipeline } = require('stream/promises');
await pipeline(readStream, transformStream, writeStream);

// JAMAIS lire un gros fichier avec fs.readFile — utiliser createReadStream
```

## Error Handling

```javascript
// Pattern try/catch pour les async
try {
  const result = await riskyOperation();
} catch (error) {
  if (error instanceof CustomError) { ... }
  // handleApiError(error) dans Klik&Go
}

// Uncaught exceptions — le process va crasher
process.on('uncaughtException', (err) => {
  console.error('Uncaught:', err);
  process.exit(1); // TOUJOURS exit apres
});

// Unhandled rejections (promises)
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// Error-first callbacks (legacy)
fs.readFile('file.txt', (err, data) => {
  if (err) return handleError(err);
  // use data
});

// assert.ifError — teste le premier arg (error-first pattern)
```

## Cluster & Performance

```javascript
// Exploiter tous les CPU cores
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isPrimary) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork(); // Cree un worker par core
  }
} else {
  // Chaque worker lance le serveur
  app.listen(3000);
}

// Klik&Go utilise le standalone output de Next.js
// Railway gere le scaling horizontalement
```

## Path Module

```javascript
const path = require('path');

path.join('/users', 'macbook', 'file.txt'); // Separateur OS-aware
path.resolve('src', 'lib'); // Chemin absolu
path.basename('/foo/bar/baz.txt'); // 'baz.txt'
path.extname('file.ts'); // '.ts'
path.dirname('/foo/bar/baz'); // '/foo/bar'
```

## Crypto Module

```javascript
const crypto = require('crypto');

// UUID generation (utilise dans Klik&Go pour les QR codes)
const uuid = crypto.randomUUID();

// Hash
const hash = crypto.createHash('sha256').update(data).digest('hex');

// HMAC (verification de webhooks Stripe/Clerk)
const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
```

## Child Processes

```javascript
const { exec, fork, spawn } = require('child_process');

// exec — execute une commande shell, retourne un buffer
exec('ls -la', (err, stdout, stderr) => { ... });

// fork — cree un nouveau process Node.js avec IPC
const child = fork('worker.js');
child.send({ task: 'process' });
child.on('message', (result) => { ... });

// spawn — streaming I/O (pour les gros outputs)
const ls = spawn('ls', ['-la']);
ls.stdout.pipe(process.stdout);

// Promisifier exec
const { promisify } = require('util');
const execAsync = promisify(exec);
const { stdout } = await execAsync('git log --oneline -5');
```

## Patterns Klik&Go specifiques

### API Route Pattern (Next.js)
```typescript
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Auth requise");

    const data = await prisma.model.findMany({ ... });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Singleton Prisma (eviter multiple instances)
```typescript
// UNE SEULE instance dans src/lib/prisma.ts
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export default prisma;
```

### Cron Jobs (node-cron dans instrumentation.ts)
```typescript
// Demarre au boot de l'app
import cron from 'node-cron';
cron.schedule('*/5 * * * *', async () => {
  // Auto-cancel expired orders, etc.
});
```

### Graceful Degradation (Redis, Email)
```typescript
// Si le service externe est down, ne pas crasher
try {
  await redis.set(key, value);
} catch {
  // Redis down — continue sans cache (no-op fallback)
}
```

## Securite

- JAMAIS exposer DATABASE_URL, API keys, secrets cote client
- Valider TOUS les inputs avec Zod avant traitement
- Rate limiting sur les endpoints sensibles (orders, auth)
- Sanitizer les outputs pour eviter XSS
- Utiliser `helmet` pour les headers HTTP securises
- CORS configure pour n'accepter que les origines autorisees
