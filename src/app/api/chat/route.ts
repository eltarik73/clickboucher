import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { getServerUserId } from "@/lib/auth/server-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(5000),
});

const chatBodySchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
  cart: z.array(z.object({
    name: z.string(),
    unit: z.string(),
    quantity: z.number(),
    weightGrams: z.number().optional(),
    priceCents: z.number(),
    sliceCount: z.number().optional(),
    thickness: z.string().optional(),
  })).optional(),
  cartShopName: z.string().max(200).nullable().optional(),
});

export const dynamic = "force-dynamic";

// Lazy singleton
let anthropic: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

// ── Extract keywords from user message ──────────
function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const stopWords = new Set([
    "je", "tu", "il", "nous", "vous", "les", "des", "une", "un", "du", "de",
    "la", "le", "et", "ou", "en", "pour", "avec", "dans", "sur", "par",
    "que", "qui", "quoi", "quel", "quelle", "mon", "ma", "mes", "ton", "ta",
    "veux", "voudrais", "veut", "peux", "peut", "faut", "fais", "fait",
    "mettre", "mets", "ajoute", "ajouter", "prendre", "prends",
    "commande", "commander", "commandes", "panier",
    "bonjour", "salut", "merci", "stp", "svp", "please",
    "est", "sont", "suis", "etes", "avez", "ont", "avoir", "etre",
    "pas", "plus", "aussi", "tout", "tous", "cette", "ces", "cet",
    "bien", "bon", "bonne", "chose", "autre", "quelque",
    "moi", "toi", "lui", "elle", "eux", "leur", "leurs",
    "encore", "deja", "toujours", "jamais", "rien", "peu",
    "personnes", "personne", "gens", "prix", "combien",
  ]);

  const words = lower
    .replace(/[^a-zàâäéèêëïîôùûüÿç\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const multiWordTerms: string[] = [];
  const foodPhrases = [
    "viande hachée", "viande hachee", "poulet fermier", "côte de boeuf", "cote de boeuf",
    "filet mignon", "escalope de", "brochette de", "gigot d'agneau", "gigot agneau",
    "épaule d'agneau", "epaule agneau", "cuisse de poulet", "blanc de poulet",
  ];
  for (const phrase of foodPhrases) {
    if (lower.includes(phrase)) {
      multiWordTerms.push(phrase);
    }
  }

  return [...new Set([...multiWordTerms, ...words])];
}

// ── Call Claude with retry on 429/overloaded ────
async function callClaude(
  client: Anthropic,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const maxRetries = 1;
  const retryDelay = 2000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: systemPrompt,
        messages,
      });

      const block = response.content[0];
      return block && block.type === "text" ? block.text : "";
    } catch (err: unknown) {
      const isRateLimit = err instanceof Anthropic.RateLimitError;
      const isOverloaded =
        err instanceof Anthropic.APIError && err.status === 529;

      if ((isRateLimit || isOverloaded) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelay));
        continue;
      }
      throw err;
    }
  }

  return "";
}

// ── Product type from DB query ──────────────────
type MatchedProduct = {
  id: string;
  name: string;
  priceCents: number;
  unit: string;
  promoPct: number | null;
  shopId: string;
  shop: { name: string; slug: string; prepTimeMin: number };
  categories: { name: string }[];
};

const PRODUCT_SELECT = {
  id: true,
  name: true,
  priceCents: true,
  unit: true,
  promoPct: true,
  shopId: true,
  shop: { select: { name: true, slug: true, prepTimeMin: true } },
  categories: { select: { name: true } },
} as const;

export async function POST(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) {
      return NextResponse.json(
        { error: "Service IA indisponible (clé API manquante)" },
        { status: 503 }
      );
    }

    const parsed = chatBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Format de message invalide" },
        { status: 400 }
      );
    }
    const allMessages = parsed.data.messages;
    const cartItems = parsed.data.cart || [];
    const cartShopName = parsed.data.cartShopName || null;

    // Keep only last 6 messages to reduce tokens
    const messages = allMessages.slice(-6);
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";

    // ── Auth (optional) — fetch recent orders if logged in ──
    let recentOrders: { orderNumber: string; status: string; totalCents: number; createdAt: Date; shopName: string; itemCount: number }[] = [];
    try {
      const userId = await getServerUserId();
      if (userId) {
        const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
        if (user) {
          const orders = await prisma.order.findMany({
            where: { userId: user.id },
            select: {
              orderNumber: true,
              status: true,
              totalCents: true,
              createdAt: true,
              shop: { select: { name: true } },
              _count: { select: { items: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          });
          recentOrders = orders.map((o) => ({
            orderNumber: o.orderNumber,
            status: o.status,
            totalCents: o.totalCents,
            createdAt: o.createdAt,
            shopName: o.shop.name,
            itemCount: o._count.items,
          }));
        }
      }
    } catch {
      // Auth/DB failed — non-blocking
    }

    // ── Fetch recipes for context ──
    let recipesContext = "";
    try {
      const recipes = await prisma.recipe.findMany({
        where: { published: true },
        select: { title: true, slug: true, meatQuantity: true, tags: true },
        orderBy: { publishedAt: "desc" },
        take: 10,
      });
      if (recipes.length > 0) {
        recipesContext = "\n\nRECETTES DISPONIBLES :\n" +
          recipes.map((r) => `- "${r.title}" (${r.meatQuantity}) — Tags: ${r.tags.join(", ")} — /recettes/${r.slug}`).join("\n");
      }
    } catch {
      // Non-blocking
    }

    // ── Extract keywords + search relevant products ──
    const keywords = extractKeywords(lastUserMsg);

    let shops: { id: string; name: string; slug: string; prepTimeMin: number; busyMode: boolean; busyExtraMin: number; rating: number }[] = [];
    let matchedProducts: MatchedProduct[] = [];

    try {
      // Combine all keyword searches into a single OR query
      const productSearch = keywords.length > 0
        ? prisma.product.findMany({
            where: {
              inStock: true,
              OR: keywords.flatMap((kw) => [
                { name: { contains: kw, mode: "insensitive" as const } },
                { categories: { some: { name: { contains: kw, mode: "insensitive" as const } } } },
              ]),
            },
            select: PRODUCT_SELECT,
            take: 15,
          })
        : Promise.resolve([] as MatchedProduct[]);

      const [shopsResult, productResults] = await Promise.all([
        prisma.shop.findMany({
          where: { status: { in: ["OPEN", "BUSY"] } },
          select: {
            id: true, name: true, slug: true,
            prepTimeMin: true, busyMode: true, busyExtraMin: true, rating: true,
          },
          orderBy: { rating: "desc" },
          take: 30,
        }),
        productSearch,
      ]);

      shops = shopsResult;
      matchedProducts = productResults;

      // Fallback: if no keyword matches, load popular products
      if (matchedProducts.length === 0) {
        const popular = await prisma.product.findMany({
          where: { inStock: true, shop: { visible: true } },
          select: PRODUCT_SELECT,
          take: 15,
          orderBy: { name: "asc" },
        });
        matchedProducts = popular;
      }
    } catch {
      // DB context fetch failed (non-blocking)
    }

    // ── Format context strings ───────────────────
    const shopsContext = shops.length
      ? shops
          .map((s) => {
            const prep = s.busyMode ? s.prepTimeMin + s.busyExtraMin : s.prepTimeMin;
            return `- ShopID:${s.id} | ${s.name} | slug:${s.slug} | ${prep}min | ${s.rating.toFixed(1)}★`;
          })
          .join("\n")
      : "Aucune boucherie disponible.";

    const productsContext = matchedProducts.length
      ? matchedProducts
          .map((p) => {
            const price = (p.priceCents / 100).toFixed(2);
            const unit = p.unit === "KG" ? "kg" : p.unit === "PIECE" ? "pièce" : "barq.";
            const promo = p.promoPct ? ` (-${p.promoPct}%)` : "";
            return `- ProductID:${p.id} | ${p.name} | ${p.categories.map(c => c.name).join(", ")} | ${price}€/${unit}${promo} | priceCents:${p.priceCents} | unit:${p.unit} | ShopID:${p.shopId} | shopName:${p.shop.name} | shopSlug:${p.shop.slug}`;
          })
          .join("\n")
      : "Aucun produit en base.";

    // ── Cart context ─────────────────────────────
    const cartContext = cartItems.length > 0
      ? `PANIER ACTUEL (chez ${cartShopName || "?"}) :\n` +
        cartItems.map((item) => {
          const price = (item.priceCents / 100).toFixed(2);
          const unit = item.unit === "KG" ? "kg" : item.unit === "TRANCHE" ? "tr." : item.unit === "PIECE" ? "pce" : "barq.";
          const weight = item.weightGrams ? ` ${item.weightGrams}g` : "";
          const slice = item.sliceCount ? ` ${item.sliceCount} tr.${item.thickness ? ` ${item.thickness}` : ""}` : "";
          return `- ${item.name} x${item.quantity}${weight}${slice} | ${price}€/${unit}`;
        }).join("\n")
      : "PANIER VIDE";

    // ── Recent orders context ──────────────────────
    const STATUS_LABELS: Record<string, string> = {
      PENDING: "En attente",
      ACCEPTED: "Acceptee",
      PREPARING: "En preparation",
      READY: "Prete",
      PICKED_UP: "Recuperee",
      COMPLETED: "Terminee",
      DENIED: "Refusee",
      CANCELLED: "Annulee",
    };

    const ordersContext = recentOrders.length > 0
      ? "COMMANDES RECENTES DU CLIENT :\n" +
        recentOrders.map((o) => {
          const status = STATUS_LABELS[o.status] || o.status;
          const date = new Date(o.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
          return `- #${o.orderNumber} | ${status} | ${(o.totalCents / 100).toFixed(2)}€ | ${o.shopName} | ${o.itemCount} articles | ${date}`;
        }).join("\n")
      : "";

    // ── System prompt ────────────────────────────
    const systemPrompt = `Tu es l'assistant Klik&Go, expert en viande halal a Chambery. Tu tutoies le client. Sois CONCIS (3-4 phrases max).

IMPORTANT : Tu ne peux ajouter au panier QUE les produits listes ci-dessous. COPIE les IDs EXACTEMENT tels quels (ils commencent par "cm"). Ne JAMAIS inventer d'ID. Si le produit demande n'est pas dans la liste, dis-le et propose ce qui est disponible.

Quand le client veut un produit de la liste, ajoute-le avec cette balise en fin de message :
<!--ACTION:{"type":"add_to_cart","productId":"COPIE_LE_ProductID","productName":"NOM","shopId":"COPIE_LE_ShopID","shopName":"COPIE_shopName","shopSlug":"COPIE_shopSlug","priceCents":COPIE_priceCents,"unit":"COPIE_unit","quantity":1,"weightGrams":500}-->

Pour weightGrams : 500 par defaut pour KG. Pour PIECE/BARQUETTE : ne pas mettre weightGrams.

Quand le client valide ("c'est bon", "je valide", "on commande") :
<!--ACTION:{"type":"go_to_checkout"}-->

${cartContext}

${ordersContext}

BOUCHERIES OUVERTES :
${shopsContext}

PRODUITS DISPONIBLES (utilise UNIQUEMENT ces IDs) :
${productsContext}
${recipesContext}

POIDS : 1kg = 1000g, 500g = 500g, 250g = 250g, 2kg = 2000g. Adapte weightGrams selon ce que demande le client. Si "1kg de steak" → weightGrams:1000. Si "500g" → weightGrams:500. Par defaut 500g. Le prix au kg se calcule proportionnellement (priceCents est pour 1kg entier).

EXPERTISE BOUCHERIE HALAL :
- Morceaux tendres (grillades rapides) : entrecote, faux-filet, rumsteak, steak, escalope
- Morceaux a mijoter (cuisson lente) : bourguignon, paleron, epaule, collier, souris d'agneau, blanquette
- BBQ/plancha : merguez, brochettes, kefta, cotes d'agneau, ailes de poulet
- Repas famille (4-6 pers) : ~1.5kg viande, 1 poulet entier, ou 1kg merguez + 500g brochettes
- Couscous : epaule d'agneau (~1.5kg pour 6) ou poulet entier + merguez
- Tajine : souris d'agneau, collier ou epaule
- Mechoui : gigot entier (~2-3kg) ou epaule (~2kg)
- Conservation frigo : 2-3 jours max pour la viande fraiche, consommer le jour meme c'est mieux
- Tranches fines (chiffonnade/carpaccio) : 15-30g par tranche, ideales pour sandwiches
- Tranches normales : 50-60g par tranche, pour plats classiques
- Astuce : sortir la viande du frigo 30 min avant cuisson pour une cuisson uniforme
- Halal certifie : toutes les viandes sont halal, abattage rituel certifie

REGLES :
- COPIE les ProductID et ShopID exactement depuis la liste. Exemple : "productId":"cmlfkv2b9000vjothecxlgfvn"
- Apres ajout : "C'est ajoute ! Autre chose ou on commande ?"
- Quand il valide : affiche recap avec total + temps + action go_to_checkout
- Le poids peut varier de +-10% (mentionne-le UNE SEULE FOIS)
- JAMAIS renvoyer vers le site. Tu fais tout.
- MAX 3-4 phrases par reponse. Sois direct.
- Si le client demande "ou en est ma commande" ou "suivi" : utilise les COMMANDES RECENTES pour lui donner le statut. Si la commande est READY, dis-lui de venir la chercher.
- Si le client a deja des articles dans son panier, mentionne-le naturellement ("je vois que tu as deja X dans ton panier").
- Si le client veut recommander une commande passee, propose les memes articles.
- Si le client demande un conseil cuisson, une recette, ou combien commander : utilise l'EXPERTISE BOUCHERIE pour repondre ET propose les produits adaptes.
- Pour les evenements (BBQ, couscous, Ramadan, Aid) : propose un pack complet avec quantites adaptees au nombre de personnes.
- Si le client demande une recette, donne le lien vers /recettes/[slug] depuis les RECETTES DISPONIBLES.`;

    // ── Call Claude API with retry ───────────────
    const content = await callClaude(client, systemPrompt, messages);

    return NextResponse.json({ role: "assistant", content });
  } catch (error: unknown) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Je suis un peu débordé, réessaie dans 5 secondes" },
        { status: 429 }
      );
    }

    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Service IA temporairement indisponible" },
        { status: 503 }
      );
    }

    console.error("[chat]", error);
    return NextResponse.json(
      { error: "Erreur du service IA" },
      { status: 500 }
    );
  }
}
