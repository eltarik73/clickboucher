---
name: react-patterns
user_invocable: false
description: Patterns React avances et hooks pour Klik&Go. Performance, state management, lifecycle, refs, context, architecture, TypeScript patterns, et anti-patterns. Sources — bulletproof-react (29k stars), typescript-cheatsheets/react (46k stars), kentcdodds/advanced-react-patterns.
---

# React Patterns — Hooks, Performance & Architecture

> Sources : bulletproof-react, typescript-cheatsheets/react, beautiful-react-hooks, kentcdodds/advanced-react-patterns

## Hooks — Regles d'or

1. Appeler les hooks UNIQUEMENT au top-level (jamais dans if/for/nested functions)
2. Appeler les hooks UNIQUEMENT dans des composants React ou des custom hooks
3. Les custom hooks DOIVENT commencer par "use" : `useCart()`, `useOrderPolling()`
4. L'ordre des hooks doit etre constant entre les renders

## useState

```tsx
// Destructuring ARRAY (pas object) — ERREUR COURANTE
const [count, setCount] = useState(0);       // BON
const { count, setCount } = useState(0);     // MAUVAIS — TypeError

// Update basee sur la valeur precedente — TOUJOURS utiliser le callback
setCount(prev => prev + 1); // BON
setCount(count + 1);        // RISQUE — stale closure

// Initialisation lazy pour les valeurs couteuses (execute UNE seule fois)
const [data, setData] = useState(() => computeExpensiveValue());

// JAMAIS muter le state directement
setItems(prev => [...prev, newItem]); // BON — nouveau tableau
items.push(newItem); setItems(items);  // MAUVAIS — meme reference

// State avec union type (nullable)
const [user, setUser] = useState<User | null>(null);
```

## useEffect

```tsx
// Side effects : fetch, subscriptions, DOM manual, timers
useEffect(() => {
  const controller = new AbortController();
  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(setData);
  return () => controller.abort(); // CLEANUP — toujours
}, [dependency]);

// [] vide = componentDidMount (une seule fois)
// Sans array = chaque render (EVITER)
// [dep] = quand dep change
```

### Async dans useEffect
```tsx
// MAUVAIS — useEffect ne peut PAS etre async
useEffect(async () => { ... }, []);

// BON — creer une function async a l'interieur
useEffect(() => {
  async function load() {
    const data = await fetchData();
    setData(data);
  }
  load();
}, []);
```

## useCallback & useMemo

```tsx
// useCallback — memoize une FONCTION (evite recreation a chaque render)
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// useMemo — memoize une VALEUR calculee
const total = useMemo(() => {
  return items.reduce((sum, item) => sum + item.price, 0);
}, [items]);

// QUAND utiliser :
// - useCallback : fonction passee en prop a un composant React.memo
// - useMemo : calcul couteux (tri, filtrage, aggregation)
// - NE PAS sur-utiliser — le memo a un cout aussi
```

## useRef

```tsx
// Acces direct au DOM (sans re-render)
const inputRef = useRef<HTMLInputElement>(null);
inputRef.current?.focus();

// Stocker une valeur mutable (sans trigger de re-render)
const prevValueRef = useRef(value);
const intervalRef = useRef<NodeJS.Timeout>();

// Pattern polling Klik&Go — toujours a jour sans re-render
const callbacksRef = useRef({ onNewOrder, onStatusChange });
callbacksRef.current = { onNewOrder, onStatusChange };
```

## useReducer

```tsx
// Preferer a useState quand le state est complexe ou les updates sont liees
// Utiliser Discriminated Unions pour les actions (type-safe)
type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'CLEAR' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'CLEAR':
      return { items: [], total: 0 };
    default:
      return state;
  }
}
```

## Context — Pattern Safe

```tsx
// Pattern avec guard (jamais de undefined en runtime)
const CartContext = createContext<CartContextType | undefined>(undefined);

function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}

// ATTENTION : tout changement de context re-render TOUS les consumers
// Solutions :
// 1. Separer en petits contextes specifiques (ThemeContext, CartContext, AuthContext)
// 2. useMemo sur la value du provider
// 3. Context pour low-velocity data (theme, user), pas high-velocity (position souris)
```

## TypeScript + React (typescript-cheatsheets/react — 46k stars)

### Props Typing
```tsx
// NE PAS utiliser React.FC — preferer typer les props directement
type AppProps = { message: string; count: number };
const App = ({ message, count }: AppProps) => <div>{message}</div>;

// Etendre les props HTML natives
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}
const Button = ({ variant = "primary", ...props }: ButtonProps) => (
  <button className={variant} {...props} />
);

// Children typing
interface LayoutProps {
  children: React.ReactNode; // Accepte tout
}
```

### Event Handling Typing
```tsx
// Inline — type infere automatiquement
<input onChange={(e) => setValue(e.target.value)} />

// Extrait — typer explicitement
const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
  setValue(e.currentTarget.value);
};

// Types d'events courants :
// React.ChangeEvent<HTMLInputElement>
// React.FormEvent<HTMLFormElement>
// React.MouseEvent<HTMLButtonElement>
// React.FocusEvent<HTMLInputElement>
// React.KeyboardEvent<HTMLInputElement>
```

### Generic Components
```tsx
// Composant Liste generique — type-safe pour n'importe quel type
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return <ul>{items.map(item => (
    <li key={keyExtractor(item)}>{renderItem(item)}</li>
  ))}</ul>;
}

// Usage : <List items={orders} renderItem={o => <OrderCard order={o} />} keyExtractor={o => o.id} />
```

### forwardRef avec TypeScript
```tsx
const TextInput = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <input ref={ref} {...props} />
));
```

## Architecture (bulletproof-react — 29k stars)

### Structure feature-based
```
src/
├── app/          # Routes, layout, providers (Next.js App Router)
├── components/   # Composants partages (ui/, layout/)
├── features/     # Code par feature
│   ├── orders/   # Tout ce qui concerne les commandes
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types/
│   ├── cart/
│   └── shops/
├── hooks/        # Custom hooks partages
├── lib/          # Librairies pre-configurees (prisma, auth, api)
├── types/        # Types globaux
└── utils/        # Utilitaires partages
```

### Flux unidirectionnel
```
shared/ → features/ → app/
```
- shared/ est importable partout
- features/ importe UNIQUEMENT de shared/
- app/ compose les features
- JAMAIS d'import entre features

## Performance (bulletproof-react)

### Code Splitting (Next.js)
```tsx
// Dynamic import — charge le composant seulement quand necessaire
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false, // Si client-only
});
```

### Children Pattern (le plus simple et efficace)
```tsx
// Les children creent un arbre vDOM isole — pas de re-render du parent
function Layout({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      {children} {/* NE re-render PAS quand count change */}
    </div>
  );
}
```

### State Localise
```tsx
// Garder le state le plus proche possible de ou il est utilise
// MAUVAIS — state global pour un filtre local
// BON — state dans le composant qui l'utilise
function OrderFilters() {
  const [filter, setFilter] = useState("all"); // Local !
  return <select value={filter} onChange={e => setFilter(e.target.value)} />;
}
```

### Styling : Build-time > Runtime
- Tailwind CSS (build-time) > styled-components/Emotion (runtime)
- Runtime CSS-in-JS cause des re-renders et du layout thrashing
- Klik&Go utilise Tailwind = BON choix performance

## Custom Hooks Patterns (beautiful-react-hooks — 8k stars)

```tsx
// useDebounce — debouncer un input (recherche, filtres)
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// useOnlineStatus — detecter si l'utilisateur est en ligne
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

// useMediaQuery — responsive dans le JS
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

// usePrevious — valeur precedente d'un state
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => { ref.current = value; });
  return ref.current;
}
```

## Patterns Klik&Go specifiques

### Server vs Client Components (Next.js App Router)
```tsx
// Server Component (default) — Prisma, auth, data fetching
export default async function Page() {
  const data = await prisma.order.findMany();
  return <ClientComponent data={data} />;
}

// Client Component — interactivite
"use client";
export default function ClientComponent({ data }: Props) {
  const [state, setState] = useState(data);
}
```

### Pattern Polling
```tsx
useEffect(() => {
  if (!enabled) return;
  fetchData();
  const interval = setInterval(fetchData, intervalMs);
  return () => clearInterval(interval);
}, [fetchData, intervalMs, enabled]);
```

### Conditional Rendering Safe
```tsx
{isLoggedIn && <Dashboard />}
{error ? <ErrorState /> : <Content />}
{status === "READY" && <ReadyBanner />}

// PIEGE : {count && <Component />} affiche "0" si count === 0
// FIX : {count > 0 && <Component />}
```

## Anti-patterns a eviter

1. **State derive** — ne pas stocker en state ce qui peut etre calcule
2. **useEffect pour sync state** — utiliser useMemo ou calcul direct
3. **Fetch sans cleanup** — toujours AbortController
4. **Key avec index** — utiliser un id unique
5. **Props drilling profond** — utiliser Context ou composition
6. **React.FC** — ne plus utiliser en React 18+, typer les props directement
7. **any dans les props** — utiliser des generics ou unknown + narrowing
8. **Gros composants** — decomposer par responsabilite
9. **Import entre features** — respecter le flux unidirectionnel
10. **Runtime CSS-in-JS** — preferer Tailwind (build-time)
