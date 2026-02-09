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
  try {
    const client = getClient();
    if (!client) {
      return NextResponse.json(
        { error: "Service IA indisponible" },
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

    // ── Live context from DB ─────────────────────
    const [shops, popularProducts, userOrders] = await Promise.all([
      // Open shops with prep time
      prisma.shop.findMany({
        where: { isOpen: true, paused: false },
        select: {
          name: true,
          address: true,
          prepTimeMin: true,
          busyMode: true,
          busyExtraMin: true,
          rating: true,
          slug: true,
        },
        orderBy: { rating: "desc" },
      }),

      // Top 20 most ordered products
      prisma.product.findMany({
        where: { inStock: true },
        select: {
          name: true,
          priceCents: true,
          unit: true,
          promoPct: true,
          shop: { select: { name: true, slug: true } },
          category: { select: { name: true } },
        },
        orderBy: { orderItems: { _count: "desc" } },
        take: 20,
      }),

      // User's last 5 orders (if authenticated)
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

    // ── Format context strings ───────────────────
    const shopsContext = shops.length
      ? shops
          .map((s) => {
            const prep = s.busyMode
              ? s.prepTimeMin + s.busyExtraMin
              : s.prepTimeMin;
            return `- ${s.name} (${s.address}) — ${prep} min de préparation, ⭐ ${s.rating.toFixed(1)}, lien: /boutique/${s.slug}`;
          })
          .join("\n")
      : "Aucune boucherie disponible pour le moment.";

    const productsContext = popularProducts.length
      ? popularProducts
          .map((p) => {
            const price = (p.priceCents / 100).toFixed(2);
            const promo = p.promoPct ? ` (-${p.promoPct}%)` : "";
            return `- ${p.name} (${p.category.name}) — ${price}€/${p.unit === "KG" ? "kg" : p.unit === "PIECE" ? "pièce" : "barquette"}${promo} chez ${p.shop.name}`;
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

RÔLE : Tu aides les clients à trouver des produits, choisir une boucherie, et passer commande.

PERSONNALITÉ : Chaleureux, expert en viande halal, conseiller culinaire. Tu tutoies le client. Tu parles français.

CONTEXTE LIVE :
Boucheries disponibles :
${shopsContext}

Produits populaires :
${productsContext}

${userContext ? `Historique du client :\n${userContext}` : "Client non connecté."}

RÈGLES :
- Recommande des produits et boucheries selon les besoins du client
- Donne des conseils de quantité : steak 150g/pers, ragoût 250g/pers, avec os 300g/pers
- Propose des idées recettes (couscous, tajine, grillades, BBQ)
- Si le client veut commander, guide-le vers la boucherie la plus adaptée
- Mentionne les temps de préparation et les promos
- Si un produit est en rupture, propose une alternative
- Sois concis (max 3-4 phrases par réponse)
- Utilise des émojis avec parcimonie (1-2 par message max)

FONCTIONS DISPONIBLES :
- Si le client demande un produit → cherche dans le catalogue et suggère
- Si le client demande une recette → donne les quantités pour X personnes
- Si le client veut commander → donne le lien vers la boutique`;

    // ── Call Claude API ──────────────────────────
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20250929",
      max_tokens: 500,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ role: "assistant", content });
  } catch (error: unknown) {
    console.error("[chat] Error:", error);

    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Trop de requêtes, réessaie dans quelques secondes." },
        { status: 429 }
      );
    }

    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Service IA indisponible (config)" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Erreur du service IA" },
      { status: 500 }
    );
  }
}
