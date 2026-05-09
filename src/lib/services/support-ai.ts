// src/lib/services/support-ai.ts — Claude AI auto-response service for support tickets
// Pure async function — NO Request/Response. Safe to call from route handlers
// without internal fetch round-trips.
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Audit 2026-05-09 : KNOWLEDGE_BASE volontairement enrichie (>1024 tokens)
// pour bénéficier du prompt caching Anthropic ephemeral (5 min TTL).
// Économie attendue : -90% input cost sur les requêtes suivantes dans la
// fenêtre de cache. Le contenu doit rester stable pour maximiser le cache hit.
const KLIKGO_KNOWLEDGE_BASE = `# Klik&Go — Knowledge Base interne (Support AI)

## Identité
Klik&Go est une plateforme SaaS de click & collect pour boucheries halal en Auvergne-Rhône-Alpes (France). Mission : zéro file d'attente, zéro stress, 100% frais. Modèle commission-only (jamais d'abonnement). 50+ boucheries partenaires sur klikandgo.app.

## Modèle économique
- Frais client : 0,99€ par commande, payés au checkout
- Commission boucher : faible % uniquement quand il vend (pas d'abonnement, pas de frais d'entrée)
- Aucune commission cachée sur les prix produits (mêmes prix qu'en magasin)
- Onboarding boucher : 24-48h de validation, gratuit, sans engagement

## Rôles utilisateurs (Clerk auth)
- CLIENT : commande viande, panier, suivi
- CLIENT_PRO / CLIENT_PRO_PENDING : compte B2B (restaurants, traiteurs)
- BOUCHER : back-office boutique, mode cuisine, catalogue
- ADMIN / WEBMASTER : modération, marketing, KPIs

## Fonctionnalités boucher (back-office)
- Dashboard : KPIs commandes, CA, top produits
- Catalogue : CRUD produits + packs + promotions, snooze produit indispo
- Commandes : Mode Cuisine 3 colonnes (Nouvelles / En cours / Prêtes)
- Paramètres : horaires d'ouverture, mode busy (extra prep time), pause manuelle, vacation mode
- Polling toutes les 5s, sons d'alerte, notifications navigateur
- Tickets imprimables 80mm (Uber Eats style) avec code retrait 4 chiffres
- Commandes programmées : auto-acceptées, basculent en "À préparer" 30 min avant retrait
- Ajustement prix/poids 3 paliers (auto-validé / délai client 5min / escalade webmaster)
- Validation poids QR scanner

## Fonctionnalités client
- Browse boutiques (homepage + carte géolocalisation)
- Boutique : produits par catégorie, badges promo, infos shop
- Panier : créneaux retrait à partir de now+10min arrondi haut, code promo, fidélité
- Checkout : guest possible (cookie token) ou Clerk auth
- Suivi commande : timeline statuts, code retrait QR, push notifications
- Programme fidélité 3 paliers : 3 cmd → -2€, 7 cmd → -5€, 15 cmd → -10€
- Favoris : sauvegarde boutiques préférées
- Recommandes : 1-tap re-order historique

## Statuts commande (state machine)
PENDING → ACCEPTED → PREPARING → READY → COMPLETED
PENDING peut basculer : AUTO_CANCELLED (expired), CANCELLED_BY_BUTCHER, CANCELLED_BY_CLIENT
État READY déclenche notif client (push + email) + génération QR retrait

## Webhooks intégrés
- Stripe (paiement à venir) : checkout.session.completed, payment_intent.*
- Clerk : user.created/updated/deleted
- Svix : signature HMAC + idempotency Redis

## Crons quotidiens
auto-cancel (commandes expirées), busy-end, performance-refresh, recipes (génération IA), abandoned-carts, unsnooze, vacation-end, ready-reminder, recurring-orders, calendar-alerts, prospect-relances, weekly-report (lun), recalc-shop-tiers (mensuel)

## Politique de remboursement
Pas de paiement en ligne actuellement (paiement sur place). Si litige client : médiation via support@klikandgo.app sous 48h ouvrées. Une fois Stripe actif : remboursement total < 30 min après commande, partiel après acceptation boucher.

## Problèmes courants & escalation
- Litige avec client : ESCALATE
- Bug technique (page ne charge pas, erreur 500) : ESCALATE
- Problème compte/connexion : ESCALATE
- Question facturation/commission : ESCALATE
- Mode cuisine ne reçoit pas les commandes : vérifier polling 5s, F5, sinon ESCALATE
- Question utilisation feature → réponse directe (référence à la knowledge base)
- Demande "comment faire X" → réponse pas-à-pas concise

## Style de réponse
- Toujours en français
- Concis (max 200 mots)
- Sans emoji (ton professionnel)
- Empathique mais factuel
- Liens vers /webmaster/aide ou /espace-boucher si pertinent`;

const SYSTEM_PROMPT = `Tu es l'assistant support officiel de Klik&Go (plateforme click & collect halal). Tu connais parfaitement le produit grâce à la knowledge base ci-dessous.

Règles strictes :
1. Réponds TOUJOURS en français, jamais en anglais
2. Maximum 200 mots
3. Si le problème nécessite intervention humaine (bug technique, paiement, litige client, remboursement, compte), commence EXACTEMENT par "ESCALATE:" suivi de ta réponse
4. Sinon (questions usage, conseils, comment faire X), réponds directement
5. Sois professionnel, empathique, factuel — pas d'emoji
6. Cite les bons chemins : /boucher/dashboard, /boucher/commandes, /espace-boucher, etc.

KNOWLEDGE BASE :
${KLIKGO_KNOWLEDGE_BASE}`;

export interface GenerateAIResponseInput {
  ticketId: string;
  userMessage: string;
  shopName?: string;
}

export interface GenerateAIResponseResult {
  ok: boolean;
  escalated?: boolean;
  reason?: string;
}

/**
 * Generate an AI response for a support ticket and persist it.
 * Robust by design:
 * - If ANTHROPIC_API_KEY is missing, logs a warning and returns ok:false (no throw).
 * - On any error, logs and returns ok:false.
 */
export async function generateAIResponse(
  input: GenerateAIResponseInput
): Promise<GenerateAIResponseResult> {
  const { ticketId, userMessage, shopName } = input;

  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn("[support-ai] ANTHROPIC_API_KEY missing — skipping AI response", { ticketId });
    return { ok: false, reason: "missing_api_key" };
  }

  try {
    // Conversation history
    const messages = await prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    if (claudeMessages.length === 0 || claudeMessages[0].role !== "user") {
      claudeMessages.unshift({ role: "user", content: userMessage });
    }

    // Ensure alternating roles
    const cleanMessages: Anthropic.MessageParam[] = [];
    for (const msg of claudeMessages) {
      if (cleanMessages.length === 0 || cleanMessages[cleanMessages.length - 1].role !== msg.role) {
        cleanMessages.push(msg);
      }
    }

    // FAQ context (best-effort)
    let faqContext = "";
    try {
      const words = userMessage
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 2);
      if (words.length > 0) {
        const faqs = await prisma.fAQ.findMany({
          where: { active: true },
          select: { question: true, answer: true, keywords: true },
        });

        const matches = faqs
          .map((faq) => {
            let score = 0;
            const lower = `${faq.question} ${faq.answer}`.toLowerCase();
            for (const w of words) {
              if (lower.includes(w)) score += 2;
            }
            for (const kw of faq.keywords) {
              if (words.some((w: string) => kw.toLowerCase().includes(w))) score += 3;
            }
            return { ...faq, score };
          })
          .filter((f) => f.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        if (matches.length > 0) {
          faqContext =
            "\n\nFAQ PERTINENTES (utilise ces reponses si elles correspondent) :\n" +
            matches.map((m) => `Q: ${m.question}\nR: ${m.answer}`).join("\n\n");
        }
      }
    } catch (err) {
      logger.warn("[support-ai] FAQ lookup failed", { err: (err as Error)?.message });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Audit 2026-05-09 : prompt caching ephemeral (5 min TTL).
    // Le SYSTEM_PROMPT (~2000 tokens) est marqué cacheable → cache hit
    // sur appels suivants dans la fenêtre = -90% input cost.
    // Le contexte boutique/FAQ change par requête → pas cacheable.
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: `Contexte requête : Boutique "${shopName ?? ""}"${faqContext}`,
        },
      ],
      messages: cleanMessages,
    });

    // Log cache stats (visible en logs Vercel pour monitoring économies)
    const usage = response.usage;
    if (usage.cache_read_input_tokens || usage.cache_creation_input_tokens) {
      logger.info("[support-ai] cache stats", {
        ticketId,
        cacheRead: usage.cache_read_input_tokens ?? 0,
        cacheWrite: usage.cache_creation_input_tokens ?? 0,
        inputUncached: usage.input_tokens,
        outputTokens: usage.output_tokens,
      });
    }

    const aiText = response.content[0].type === "text" ? response.content[0].text : "";

    const isEscalated = aiText.startsWith("ESCALATE:");
    const cleanText = isEscalated ? aiText.replace("ESCALATE:", "").trim() : aiText;

    await prisma.supportMessage.create({
      data: {
        ticketId,
        role: "ai",
        content: cleanText,
      },
    });

    if (isEscalated) {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: "ESCALATED", escalatedAt: new Date() },
      });
    } else {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: "AI_HANDLED" },
      });
    }

    return { ok: true, escalated: isEscalated };
  } catch (error) {
    logger.error("[support-ai] generation failed", {
      ticketId,
      err: (error as Error)?.message,
    });
    return { ok: false, reason: "generation_failed" };
  }
}
