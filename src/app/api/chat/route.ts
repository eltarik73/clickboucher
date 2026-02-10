import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// Lazy singleton
let anthropic: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

export async function POST(req: NextRequest) {
  console.log("[chat] ANTHROPIC_API_KEY exists:", !!process.env.ANTHROPIC_API_KEY);

  try {
    const client = getClient();
    if (!client) {
      console.error("[chat] No ANTHROPIC_API_KEY — returning 503");
      return NextResponse.json(
        { error: "Service IA indisponible (clé API manquante)" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const messages: { role: "user" | "assistant"; content: string }[] =
      body.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages requis" },
        { status: 400 }
      );
    }

    // ── Auth (optional) ──────────────────────────
    let userId: string | null = null;
    try {
      const { userId: clerkId } = await auth();
      userId = clerkId;
    } catch {
      // Not authenticated — that's fine
    }

    // ── Live context from DB (non-blocking) ──────
    let shops: { id: string; name: string; slug: string; address: string; city: string; prepTimeMin: number; busyMode: boolean; busyExtraMin: number; rating: number }[] = [];
    let allProducts: { id: string; name: string; priceCents: number; unit: string; promoPct: number | null; shopId: string; shop: { name: string; slug: string; prepTimeMin: number; address: string; city: string }; category: { name: string } }[] = [];
    let userOrders: { orderNumber: string; status: string; totalCents: number; createdAt: Date; shop: { name: string }; items: { name: string; quantity: number; unit: string }[] }[] = [];

    try {
      [shops, allProducts, userOrders] = await Promise.all([
        prisma.shop.findMany({
          where: { isOpen: true, paused: false },
          select: {
            id: true,
            name: true,
            slug: true,
            address: true,
            city: true,
            prepTimeMin: true,
            busyMode: true,
            busyExtraMin: true,
            rating: true,
          },
          orderBy: { rating: "desc" },
        }),

        prisma.product.findMany({
          where: { inStock: true },
          select: {
            id: true,
            name: true,
            priceCents: true,
            unit: true,
            promoPct: true,
            shopId: true,
            shop: { select: { name: true, slug: true, prepTimeMin: true, address: true, city: true } },
            category: { select: { name: true } },
          },
          take: 150,
        }),

        userId
          ? prisma.order.findMany({
              where: { user: { clerkId: userId } },
              select: {
                orderNumber: true,
                status: true,
                totalCents: true,
                createdAt: true,
                shop: { select: { name: true } },
                items: { select: { name: true, quantity: true, unit: true } },
              },
              orderBy: { createdAt: "desc" },
              take: 5,
            })
          : Promise.resolve([]),
      ]);
    } catch (dbError: unknown) {
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error("[chat] DB context fetch failed (non-blocking):", msg);
    }

    // ── Format context strings ───────────────────
    const shopsContext = shops.length
      ? shops
          .map((s) => {
            const prep = s.busyMode
              ? s.prepTimeMin + s.busyExtraMin
              : s.prepTimeMin;
            return `- ID:${s.id} | ${s.name} | ${s.address}, ${s.city} | ${prep} min | ⭐ ${s.rating.toFixed(1)}`;
          })
          .join("\n")
      : "Aucune boucherie disponible pour le moment.";

    const productsContext = allProducts.length
      ? allProducts
          .map((p) => {
            const price = (p.priceCents / 100).toFixed(2);
            const unitLabel = p.unit === "KG" ? "kg" : p.unit === "PIECE" ? "pièce" : "barquette";
            const promo = p.promoPct ? ` (-${p.promoPct}%)` : "";
            return `- ID:${p.id} | ${p.name} | ${p.category.name} | ${price}€/${unitLabel}${promo} | Shop:${p.shopId} ${p.shop.name} (${p.shop.prepTimeMin}min, ${p.shop.address})`;
          })
          .join("\n")
      : "Catalogue en cours de chargement.";

    const userContext =
      userOrders.length > 0
        ? userOrders
            .map((o) => {
              const items = o.items
                .map((i) => `${i.name} x${i.quantity}`)
                .join(", ");
              return `- #${o.orderNumber} chez ${o.shop.name} (${o.status}) — ${items} — ${(o.totalCents / 100).toFixed(2)}€`;
            })
            .join("\n")
        : null;

    // ── System prompt ────────────────────────────
    const systemPrompt = `Tu es l'assistant IA de Klik&Go, une application de click & collect pour boucheries halal à Chambéry.
Tu tutoies le client. Tu parles français. Tu es chaleureux, expert en viande halal, et conseiller culinaire.

COMMANDE DIRECTE :
Quand le client veut un produit, tu l'ajoutes directement au panier via une action cachée.
À la fin de ton message texte, ajoute sur une nouvelle ligne (invisible pour le client) :
<!--ACTION:{"type":"add_to_cart","productId":"ID","productName":"NOM","shopId":"SHOP_ID","shopName":"NOM_SHOP","shopSlug":"SLUG_SHOP","priceCents":PRIX,"unit":"UNITE","quantity":1,"weightGrams":POIDS}-->

Pour UNITE utilise "KG", "PIECE" ou "BARQUETTE" selon le produit.
Pour weightGrams, utilise le poids en grammes demandé (ex: 500 pour 500g, 1000 pour 1kg). Si pas de poids mentionné, utilise 500 par défaut pour les produits au KG.

Pour valider la commande quand le client dit "c'est bon" / "c'est tout" / "je valide" :
<!--ACTION:{"type":"go_to_checkout"}-->

RÈGLES :
- Quand le client mentionne un produit + quantité → ajoute DIRECTEMENT au panier sans demander confirmation
- Après ajout, dis : "C'est ajouté ! Tu veux autre chose ou on passe à la commande ?"
- Quand le client dit "c'est bon" / "c'est tout" / "je valide" → affiche un récap et propose de valider
- Utilise TOUJOURS les vrais productId et shopId de la liste PRODUITS DISPONIBLES ci-dessous
- Ne renvoie JAMAIS le client vers le site. Fais tout toi-même.
- Propose toujours la boucherie la plus rapide ou la mieux notée
- Donne des conseils de quantité : steak 150g/pers, ragoût 250g/pers, avec os 300g/pers
- Propose des idées recettes (couscous, tajine, grillades, BBQ)
- Mentionne les temps de préparation et les promos
- Si un produit est en rupture, propose une alternative
- Sois concis (max 3-4 phrases par réponse)
- Utilise des émojis avec parcimonie (1-2 par message max)

MESSAGE POIDS :
Après le PREMIER ajout au panier dans une conversation, ajoute ce message :
"💡 Le poids exact peut varier légèrement de ±10% — c'est normal pour de la viande fraîche coupée à la main. Le prix final sera ajusté en conséquence."
Ce message ne doit apparaître qu'UNE SEULE FOIS par conversation, pas à chaque ajout.

RÉCAP COMMANDE (quand le client valide) :
Affiche un récap clair :
🛒 Ta commande :
• [produit] — [quantité] — [prix]€
• [produit] — [quantité] — [prix]€
💰 Total estimé : XX,XX€
⏱ Prêt en ~XX min

Puis ajoute l'action checkout.

BOUCHERIES DISPONIBLES :
${shopsContext}

PRODUITS DISPONIBLES :
${productsContext}

${userContext ? `HISTORIQUE DU CLIENT :\n${userContext}` : "Client non connecté."}`;

    // ── Call Claude API ──────────────────────────
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ role: "assistant", content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[chat] Error:", message, error);

    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Trop de requêtes, réessaie dans quelques secondes." },
        { status: 429 }
      );
    }

    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Clé API Anthropic invalide. Vérifiez ANTHROPIC_API_KEY." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Erreur du service IA : ${message}` },
      { status: 500 }
    );
  }
}
