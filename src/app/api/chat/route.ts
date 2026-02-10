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

// ── Extract keywords from user message ──────────
function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  // Remove common filler words
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
    "bien", "bon", "bonne", "chose", "chose", "autre", "quelque",
    "moi", "toi", "lui", "elle", "eux", "leur", "leurs",
    "encore", "deja", "toujours", "jamais", "rien", "peu",
    "personnes", "personne", "gens", "prix", "combien",
  ]);

  const words = lower
    .replace(/[^a-zàâäéèêëïîôùûüÿç\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Also detect multi-word food terms
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

      return response.content[0].type === "text" ? response.content[0].text : "";
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

export async function POST(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) {
      return NextResponse.json(
        { error: "Service IA indisponible (clé API manquante)" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const allMessages: { role: "user" | "assistant"; content: string }[] =
      body.messages;

    if (!allMessages || !Array.isArray(allMessages) || allMessages.length === 0) {
      return NextResponse.json(
        { error: "Messages requis" },
        { status: 400 }
      );
    }

    // Keep only last 6 messages to reduce tokens
    const messages = allMessages.slice(-6);
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";

    // ── Auth (optional) ──────────────────────────
    let userId: string | null = null;
    try {
      const { userId: clerkId } = await auth();
      userId = clerkId;
    } catch {
      // Not authenticated — that's fine
    }

    // ── Extract keywords + search relevant products ──
    const keywords = extractKeywords(lastUserMsg);

    let shops: { id: string; name: string; slug: string; address: string; city: string; prepTimeMin: number; busyMode: boolean; busyExtraMin: number; rating: number }[] = [];
    let matchedProducts: { id: string; name: string; priceCents: number; unit: string; promoPct: number | null; shopId: string; shop: { name: string; slug: string; prepTimeMin: number; address: string; city: string }; category: { name: string } }[] = [];

    try {
      const productSearches = keywords.length > 0
        ? keywords.map((kw) =>
            prisma.product.findMany({
              where: {
                inStock: true,
                OR: [
                  { name: { contains: kw, mode: "insensitive" as const } },
                  { category: { name: { contains: kw, mode: "insensitive" as const } } },
                ],
              },
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
              take: 5,
            })
          )
        : [];

      const [shopsResult, ...productResults] = await Promise.all([
        prisma.shop.findMany({
          where: { isOpen: true, paused: false },
          select: {
            id: true, name: true, slug: true, address: true, city: true,
            prepTimeMin: true, busyMode: true, busyExtraMin: true, rating: true,
          },
          orderBy: { rating: "desc" },
        }),
        ...productSearches,
      ]);

      shops = shopsResult;

      // Dedupe products by id, limit to 10
      const seen = new Set<string>();
      for (const results of productResults) {
        for (const p of results) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            matchedProducts.push(p);
          }
          if (matchedProducts.length >= 10) break;
        }
        if (matchedProducts.length >= 10) break;
      }
    } catch (dbError: unknown) {
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error("[chat] DB context fetch failed (non-blocking):", msg);
    }

    // ── Format context strings ───────────────────
    const shopsContext = shops.length
      ? shops
          .map((s) => {
            const prep = s.busyMode ? s.prepTimeMin + s.busyExtraMin : s.prepTimeMin;
            return `- ID:${s.id} | ${s.name} | ${s.address}, ${s.city} | ${prep}min | ${s.rating.toFixed(1)}★`;
          })
          .join("\n")
      : "Aucune boucherie disponible.";

    const productsContext = matchedProducts.length
      ? matchedProducts
          .map((p) => {
            const price = (p.priceCents / 100).toFixed(2);
            const unit = p.unit === "KG" ? "kg" : p.unit === "PIECE" ? "pièce" : "barq.";
            const promo = p.promoPct ? ` (-${p.promoPct}%)` : "";
            return `- ID:${p.id} | ${p.name} | ${p.category.name} | ${price}€/${unit}${promo} | Shop:${p.shopId} ${p.shop.name} (${p.shop.slug})`;
          })
          .join("\n")
      : "Aucun produit trouvé pour cette recherche. Propose au client de reformuler ou suggère des catégories : Bœuf, Volaille, Agneau, Merguez, Grillades.";

    // ── System prompt (compact) ──────────────────
    const systemPrompt = `Tu es l'assistant Klik&Go, expert en viande halal à Chambéry. Tu tutoies le client. Sois CONCIS (3-4 phrases max).

Quand le client veut un produit, ajoute-le au panier avec cette balise invisible en fin de message :
<!--ACTION:{"type":"add_to_cart","productId":"ID","productName":"NOM","shopId":"SHOP_ID","shopName":"NOM_SHOP","shopSlug":"SLUG_SHOP","priceCents":PRIX,"unit":"UNITE","quantity":1,"weightGrams":POIDS}-->

Pour UNITE : "KG", "PIECE" ou "BARQUETTE". Pour weightGrams : poids en grammes (défaut 500 pour KG).

Quand le client valide ("c'est bon", "je valide", "on commande") :
<!--ACTION:{"type":"go_to_checkout"}-->

BOUCHERIES :
${shopsContext}

PRODUITS TROUVÉS :
${productsContext}

RÈGLES :
- Ajoute directement au panier quand le client demande un produit
- Après ajout : "C'est ajouté ! Autre chose ou on commande ?"
- Quand il valide : affiche récap avec total + temps + action go_to_checkout
- Le poids peut varier de ±10% (mentionne-le UNE SEULE FOIS)
- JAMAIS renvoyer vers le site. Tu fais tout.
- MAX 3-4 phrases par réponse. Sois direct.`;

    // ── Call Claude API with retry ───────────────
    const content = await callClaude(client, systemPrompt, messages);

    return NextResponse.json({ role: "assistant", content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[chat] Error:", message);

    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Je suis un peu débordé, réessaie dans 5 secondes 🙏" },
        { status: 429 }
      );
    }

    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Clé API Anthropic invalide." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Erreur du service IA : ${message}` },
      { status: 500 }
    );
  }
}
