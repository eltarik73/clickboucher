---
name: javascript-expert
user_invocable: false
description: Patterns JavaScript avances pour Klik&Go. Closures, async/await, prototypes, event loop, error handling, et bonnes pratiques ES2024. Utiliser pour ecrire du JS idiomatique, performant et sans bugs.
---

# JavaScript Expert — Patterns & Best Practices

## Closures & Scope

- `var` est function-scoped et hoist (valeur `undefined` avant declaration)
- `let`/`const` sont block-scoped, pas de hoisting accessible
- Une closure capture les variables de son scope parent par reference, pas par valeur
- Pattern IIFE pour isoler le scope : `(function() { ... })()`
- Attention aux closures dans les boucles : utiliser `let` ou IIFE pour capturer la valeur

```javascript
// MAUVAIS — var est partage dans la closure
for (var i = 0; i < 5; i++) {
  setTimeout(() => console.log(i), 100); // 5,5,5,5,5
}
// BON — let cree un nouveau scope par iteration
for (let i = 0; i < 5; i++) {
  setTimeout(() => console.log(i), 100); // 0,1,2,3,4
}
```

## Async / Await / Promises

- `async` function retourne toujours une Promise
- `await` ne bloque PAS le thread — il suspend l'execution de la function async
- Toujours wrapper les await dans try/catch pour la gestion d'erreurs
- `Promise.all()` pour paralleliser, `Promise.allSettled()` pour ne pas echouer si une rejette
- `Promise.race()` pour timeout pattern

```javascript
// Pattern parallel (utilise dans les API routes Klik&Go)
const [shops, products] = await Promise.all([
  prisma.shop.findMany(),
  prisma.product.findMany(),
]);

// Pattern timeout
const result = await Promise.race([
  fetch('/api/data'),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
]);
```

## Event Loop & Execution Order

1. Call stack (synchrone) s'execute d'abord
2. Microtasks (Promise.then, queueMicrotask) ensuite
3. Macrotasks (setTimeout, setInterval, I/O) apres
4. `process.nextTick()` (Node) s'execute AVANT les microtasks

```javascript
console.log('1');           // Sync → 1er
setTimeout(() => console.log('2'), 0); // Macro → 4e
Promise.resolve().then(() => console.log('3')); // Micro → 3e
console.log('4');           // Sync → 2e
// Output: 1, 4, 3, 2
```

## Types & Coercion

- `===` compare valeur ET type (toujours utiliser)
- `==` fait de la coercion (eviter sauf cas explicite)
- `typeof null === 'object'` (bug historique JS)
- `NaN !== NaN` (utiliser `Number.isNaN()`)
- `[] == []` est `false` (references differentes)
- `Boolean("false")` est `true` (string non-vide)
- `0 && "hello"` retourne `0` (short-circuit)
- `"" || "default"` retourne `"default"` (nullish fallback)
- Preferer `??` a `||` pour les fallbacks (ne traite pas 0 et "" comme falsy)

## Objets & Prototypes

- Tout objet a un prototype (`__proto__` ou `Object.getPrototypeOf()`)
- Chaine : `instance → Constructor.prototype → Object.prototype → null`
- `let arr = []` a 2 prototypes : Array.prototype → Object.prototype
- `Object.keys()` retourne les cles propres enumerables
- `Map` > `Object` quand les cles ne sont pas des strings ou pour compter (.size)
- `Set` pour les valeurs uniques uniquement
- Destructuring : `const { a, b } = obj` ou `const [x, y] = arr`
- Spread : `{ ...obj, newProp: val }` pour copie shallow + modification

## Error Handling

- `throw new Error('message')` pour les erreurs custom
- `try/catch/finally` — finally s'execute TOUJOURS
- Catch les erreurs au bon niveau (pas trop haut, pas trop bas)
- Pattern Klik&Go : `handleApiError(error)` centralise dans les API routes
- Jamais catch silencieux sauf fire-and-forget explicite : `.catch(() => {})`

## Array Methods (les plus utilises dans Klik&Go)

```javascript
// map — transformer chaque element
const prices = items.map(item => item.priceCents / 100);

// filter — garder ceux qui matchent
const available = products.filter(p => p.inStock);

// reduce — agreger en une valeur
const total = items.reduce((sum, item) => sum + item.totalCents, 0);

// find — premier match
const order = orders.find(o => o.id === orderId);

// some / every — test boolean
const hasExpensive = items.some(i => i.priceCents > 5000);
const allAvailable = items.every(i => i.available);

// flatMap — map + flatten
const allItems = orders.flatMap(o => o.items);
```

## Generators & Iterators

- `function*` cree un generateur avec `yield`
- L'execution peut etre suspendue et reprise
- Utile pour les sequences lazy, pagination, etc.

## Modules ES

- `import x from 'module'` — default export
- `import { x } from 'module'` — named export
- `import * as lib from 'module'` — namespace import
- Dynamic import : `const mod = await import('./module')` — code splitting Next.js

## Performance Patterns

- Eviter les creations d'objets dans les boucles hot
- `Map` pour les lookups frequents au lieu d'array.find()
- `Set` pour les tests d'appartenance au lieu d'array.includes()
- Debounce les handlers d'input (300ms typique)
- `requestAnimationFrame` pour les animations smooth
- `AbortController` pour annuler les fetch en cours

```javascript
// Pattern Map lookup (utilise dans les API orders Klik&Go)
const productMap = new Map(products.map(p => [p.id, p]));
const product = productMap.get(itemId); // O(1) au lieu de O(n)
```
