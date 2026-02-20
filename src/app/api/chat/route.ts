import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

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
  category: { name: string };
};

const PRODUCT_SELECT = {
  id: true,
  name: true,
  priceCents: true,
  unit: true,
  promoPct: true,
  shopId: true,
  shop: { select: { name: true, slug: true, prepTimeMin: true } },
  category: { select: { name: true } },
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
    try {
      await auth();
    } catch {
      // Not authenticated — that's fine
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
                { category: { name: { contains: kw, mode: "insensitive" as const } } },
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
          where: { inStock: true },
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
            return `- ProductID:${p.id} | ${p.name} | ${p.category.name} | ${price}€/${unit}${promo} | priceCents:${p.priceCents} | unit:${p.unit} | ShopID:${p.shopId} | shopName:${p.shop.name} | shopSlug:${p.shop.slug}`;
          })
          .join("\n")
      : "Aucun produit en base.";

    // ── System prompt ────────────────────────────
    const systemPrompt = `Tu es l'assistant Klik&Go, expert en viande halal a Chambery. Tu tutoies le client. Sois CONCIS (3-4 phrases max).

IMPORTANT : Tu ne peux ajouter au panier QUE les produits listes ci-dessous. COPIE les IDs EXACTEMENT tels quels (ils commencent par "cm"). Ne JAMAIS inventer d'ID. Si le produit demande n'est pas dans la liste, dis-le et propose ce qui est disponible.

Quand le client veut un produit de la liste, ajoute-le avec cette balise en fin de message :
<!--ACTION:{"type":"add_to_cart","productId":"COPIE_LE_ProductID","productName":"NOM","shopId":"COPIE_LE_ShopID","shopName":"COPIE_shopName","shopSlug":"COPIE_shopSlug","priceCents":COPIE_priceCents,"unit":"COPIE_unit","quantity":1,"weightGrams":500}-->

Pour weightGrams : 500 par defaut pour KG. Pour PIECE/BARQUETTE : ne pas mettre weightGrams.

Quand le client valide ("c'est bon", "je valide", "on commande") :
<!--ACTION:{"type":"go_to_checkout"}-->

BOUCHERIES OUVERTES :
${shopsContext}

PRODUITS DISPONIBLES (utilise UNIQUEMENT ces IDs) :
${productsContext}

POIDS : 1kg = 1000g, 500g = 500g, 250g = 250g, 2kg = 2000g. Adapte weightGrams selon ce que demande le client. Si "1kg de steak" → weightGrams:1000. Si "500g" → weightGrams:500. Par defaut 500g. Le prix au kg se calcule proportionnellement (priceCents est pour 1kg entier).

REGLES :
- COPIE les ProductID et ShopID exactement depuis la liste. Exemple : "productId":"cmlfkv2b9000vjothecxlgfvn"
- Apres ajout : "C'est ajoute ! Autre chose ou on commande ?"
- Quand il valide : affiche recap avec total + temps + action go_to_checkout
- Le poids peut varier de +-10% (mentionne-le UNE SEULE FOIS)
- JAMAIS renvoyer vers le site. Tu fais tout.
- MAX 3-4 phrases par reponse. Sois direct.`;

    // ── Call Claude API with retry ───────────────
    const content = await callClaude(client, systemPrompt, messages);

    return NextResponse.json({ role: "assistant", content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

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
