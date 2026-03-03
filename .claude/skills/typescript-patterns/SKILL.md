---
name: typescript-patterns
user_invocable: false
description: Patterns TypeScript avances pour Klik&Go. Types, generics, utility types, narrowing, et bonnes pratiques. Utiliser pour ecrire du TypeScript type-safe, maintenable et sans any.
---

# TypeScript Patterns — Types, Generics & Safety

## Principes fondamentaux

- TypeScript = superset de JavaScript avec types statiques
- Compile vers JS via `tsc` (ou Next.js/SWC automatiquement)
- Config dans `tsconfig.json` — `strict: true` toujours active
- Le but : attraper les bugs au compile-time, pas au runtime

## Types de base

```typescript
// Primitifs
let name: string = "Klik&Go";
let price: number = 1299; // centimes
let inStock: boolean = true;
let nothing: null = null;
let notDefined: undefined = undefined;

// Arrays
let items: string[] = ["Entrecote", "Merguez"];
let ids: Array<string> = []; // Equivalent

// Tuples — array avec types fixes par position
type PriceRange = [number, number]; // [min, max]
const range: PriceRange = [500, 2000];

// Enums (preferer les union types en general)
enum Status { PENDING, ACCEPTED, READY }

// Union types (prefere aux enums pour les strings)
type OrderStatus = "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "PICKED_UP";
```

## Interfaces vs Types

```typescript
// Interface — pour les objets, extensible
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  priceCents: number;
  weightGrams?: number; // ? = optionnel
  readonly productId: string; // readonly = pas modifiable
}

// Extend une interface
interface ProOrderItem extends OrderItem {
  proPriceCents: number;
}

// Type — pour tout (unions, intersections, mapped types)
type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
};

// Intersection — combine deux types
type OrderWithShop = Order & { shop: Shop };
```

## Generics

```typescript
// Fonction generique
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

// Avec contrainte
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Pattern API Klik&Go
function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}
```

## Utility Types (les plus utilises)

```typescript
// Partial<T> — toutes les props deviennent optionnelles
type UpdateOrder = Partial<Order>; // Pour les PATCH

// Required<T> — toutes les props deviennent requises
type StrictOrder = Required<Order>;

// Pick<T, K> — garder certaines props
type OrderSummary = Pick<Order, "id" | "orderNumber" | "totalCents" | "status">;

// Omit<T, K> — exclure certaines props
type OrderCreate = Omit<Order, "id" | "createdAt" | "updatedAt">;

// Record<K, V> — objet avec cles typees
type StatusLabels = Record<OrderStatus, string>;
const labels: StatusLabels = {
  PENDING: "En attente",
  ACCEPTED: "Acceptee",
  // ...
};

// Exclude<T, U> — retirer d'une union
type ActiveStatus = Exclude<OrderStatus, "PICKED_UP" | "CANCELLED">;

// ReturnType<T> — extraire le type de retour
type ApiResult = ReturnType<typeof fetchOrders>;

// Parameters<T> — extraire les types des parametres
type FetchParams = Parameters<typeof fetch>;

// NonNullable<T> — retirer null et undefined
type SafeString = NonNullable<string | null | undefined>; // string
```

## Type Narrowing (type guards)

```typescript
// typeof guard
function format(value: string | number) {
  if (typeof value === "string") {
    return value.toUpperCase(); // TS sait que c'est string ici
  }
  return value.toFixed(2); // TS sait que c'est number ici
}

// in guard
function isOrder(obj: Order | Product): obj is Order {
  return "orderNumber" in obj;
}

// Discriminated unions (pattern tres utilise dans Klik&Go)
type ApiResult =
  | { success: true; data: Order }
  | { success: false; error: { code: string; message: string } };

function handle(result: ApiResult) {
  if (result.success) {
    console.log(result.data); // TS sait que data existe
  } else {
    console.log(result.error); // TS sait que error existe
  }
}
```

## Operateurs utiles

```typescript
// Non-null assertion (!) — "je sais que c'est pas null"
const element = document.getElementById("app")!;
// A utiliser avec parcimonie — preferer le narrowing

// Optional chaining (?.)
const city = order?.shop?.address?.city;

// Nullish coalescing (??)
const name = user?.firstName ?? "Client"; // Seulement si null/undefined
// Difference avec || : 0 ?? "default" → 0, mais 0 || "default" → "default"

// Type assertion (as)
const data = json as OrderData;
// Utiliser quand tu sais mieux que TS (API responses, etc.)

// Satisfies — valider le type sans le changer
const config = {
  port: 3000,
  host: "localhost",
} satisfies Record<string, string | number>;

// keyof — union des cles d'un type
type OrderKeys = keyof Order; // "id" | "orderNumber" | "status" | ...

// typeof — extraire le type d'une valeur
const defaultOrder = { status: "PENDING", totalCents: 0 };
type OrderDefaults = typeof defaultOrder;
```

## Patterns Klik&Go specifiques

### Props de composant
```typescript
// Toujours typer les props explicitement
type KitchenOrderCardProps = {
  order: KitchenOrder;
  shopName?: string;
  onAction: (orderId: string, action: string, data?: Record<string, unknown>) => Promise<void>;
};
```

### Zod + TypeScript (validation)
```typescript
import { z } from "zod";

const createOrderSchema = z.object({
  shopId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
});

// Extraire le type TS depuis le schema Zod
type CreateOrderInput = z.infer<typeof createOrderSchema>;
```

### Record pour les mappings status
```typescript
const STATUS_COLORS: Record<string, string> = {
  PENDING: "border-t-amber-400",
  ACCEPTED: "border-t-blue-400",
  PREPARING: "border-t-indigo-400",
  READY: "border-t-emerald-400",
};
```

## Anti-patterns a eviter

1. **`any`** — utiliser `unknown` + narrowing a la place
2. **Type assertions excessives** — `as` cache les vrais problemes
3. **Interfaces vides** — `interface Props {}` est inutile, utiliser `Record<string, never>`
4. **Enum string** — preferer les union types : `type X = "a" | "b"`
5. **`!` partout** — preferer le narrowing ou les valeurs par defaut
6. **Ignorer les erreurs TS** — `@ts-ignore` est un dernier recours
