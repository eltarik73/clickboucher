---
name: stripe-payment
description: Expert Stripe pour Klik&Go. Utiliser pour le paiement en ligne, Checkout Sessions, webhooks, remboursements, et sécurité PCI. Gère le paiement click & collect avec 2 modes (en ligne et sur place).
---

# Stripe Payment — Klik&Go

## Architecture paiement

### 2 modes
1. **ON_PICKUP** (sur place) → Pas de Stripe, le boucher encaisse directement
2. **ONLINE** (en ligne) → Stripe Checkout Session (hébergé par Stripe = PCI-DSS auto)

### Flux paiement en ligne
```
Client clique "Commander" (paymentMethod: ONLINE)
  → POST /api/checkout
    → Créer Order en DB (status: PENDING, paidAt: null)
    → stripe.checkout.sessions.create({
        line_items: items mappés,
        mode: 'payment',
        success_url: /commande/[id]/confirmation?session_id={CHECKOUT_SESSION_ID},
        cancel_url: /panier,
        metadata: { orderId: order.id }
      })
    → Retourner session.url
  → Redirect client vers Stripe Checkout
  → Client paie chez Stripe (3D Secure auto)
  → Stripe redirige vers success_url

EN PARALLÈLE :
  → Stripe envoie webhook checkout.session.completed
  → POST /api/webhooks/stripe
    → Vérifier signature
    → Mettre à jour order.paidAt = now()
    → Le boucher reçoit l'alerte commande
```

### Flux paiement sur place
```
Client clique "Commander" (paymentMethod: ON_PICKUP)
  → POST /api/orders
    → Créer Order en DB (status: PENDING, paymentMethod: ON_PICKUP)
    → Le boucher reçoit l'alerte commande immédiatement
    → Le client paie au retrait
```

## Code Stripe

### Création Checkout Session
```typescript
// POST /api/checkout/route.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  // TOUJOURS recalculer le total côté serveur
  const order = await prisma.order.findUnique({
    where: { id: body.orderId },
    include: { items: { include: { product: true } }, shop: true }
  })

  if (!order) return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 })

  const lineItems = order.items.map(item => ({
    price_data: {
      currency: 'eur',
      product_data: {
        name: item.product.name,
        description: `${item.quantity}${item.unit}`,
      },
      unit_amount: item.priceCents, // PRIX DU SERVEUR, jamais du client
    },
    quantity: 1,
  }))

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/commande/${order.id}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/panier`,
    metadata: { orderId: order.id },
    payment_intent_data: {
      metadata: { orderId: order.id }
    }
  })

  return NextResponse.json({ url: session.url })
}
```

### Webhook Stripe
```typescript
// POST /api/webhooks/stripe/route.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    // TOUJOURS vérifier la signature
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.orderId

    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paidAt: new Date(),
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string,
        }
      })
      console.log(`✅ Paiement confirmé pour commande ${orderId}`)
    }
  }

  return NextResponse.json({ received: true })
}

// IMPORTANT : désactiver le bodyParser pour les webhooks
export const config = {
  api: { bodyParser: false }
}
```

### Remboursement
```typescript
// Quand le boucher refuse/annule une commande déjà payée
if (order.paidAt && order.stripePaymentIntentId) {
  await stripe.refunds.create({
    payment_intent: order.stripePaymentIntentId,
    reason: 'requested_by_customer'
  })
  await prisma.order.update({
    where: { id: order.id },
    data: { refundedAt: new Date() }
  })
}
```

## Sécurité ABSOLUE
- ❌ JAMAIS stocker de numéro de carte
- ❌ JAMAIS envoyer le montant depuis le client (recalculer côté serveur)
- ❌ JAMAIS exposer STRIPE_SECRET_KEY côté client
- ❌ JAMAIS skip la vérification de signature webhook
- ✅ TOUJOURS utiliser NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY côté client
- ✅ TOUJOURS recalculer les prix depuis la DB
- ✅ TOUJOURS checkout.session.completed comme source de vérité
- ✅ TOUJOURS idempotency key sur les opérations critiques

## Variables d'environnement
```
STRIPE_SECRET_KEY=sk_test_...          # Serveur uniquement
STRIPE_WEBHOOK_SECRET=whsec_...        # Serveur uniquement
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Client OK
```

## Test
- Carte test : 4242 4242 4242 4242 (expire: n'importe quelle date future, CVC: n'importe quel)
- 3D Secure test : 4000 0025 0000 3155
- Carte refusée : 4000 0000 0000 0002
- Webhook local : `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
