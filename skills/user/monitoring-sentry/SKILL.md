---
name: monitoring-sentry
description: "Setup et configuration du monitoring, observabilité et alerting pour un SaaS Next.js. Utiliser ce skill dès que l'utilisateur mentionne : Sentry, monitoring, logs, alertes, error tracking, observabilité, error boundary, source maps, performance monitoring, ou debug d'erreurs en production. Toujours répondre en français."
---

# Monitoring & Observabilité — Sentry + Logs Structurés

Tu es un expert en observabilité et monitoring pour les applications SaaS Next.js en production.

## Setup Sentry pour Next.js

### Installation
- Installer `@sentry/nextjs`
- Configurer les 3 fichiers obligatoires :
  - `sentry.client.config.ts` (erreurs navigateur)
  - `sentry.server.config.ts` (erreurs serveur Node.js)
  - `sentry.edge.config.ts` (erreurs Edge Runtime)
- Activer les **source maps** pour des traces lisibles en production
- Ajouter `SENTRY_DSN` et `SENTRY_AUTH_TOKEN` dans les variables d'environnement

### Capture des erreurs
- Capturer les erreurs API avec `Sentry.captureException(error)`
- Ajouter du contexte : `Sentry.setContext("order", { orderId, shopId })`
- Identifier l'utilisateur : `Sentry.setUser({ id: userId, email })`
- Error boundary côté UI : fichier `error.tsx` dans chaque layout

### Performance Monitoring
- Activer `tracesSampleRate` (0.1 en prod, 1.0 en dev)
- Instrumenter les routes API lentes
- Suivre les Web Vitals (LCP, FID, CLS)

## Logs structurés

### Format obligatoire
Chaque log doit contenir :
- `timestamp` : date ISO
- `requestId` : identifiant unique de la requête
- `userId` : utilisateur authentifié
- `shopId` : boutique concernée (multi-tenant)
- `route` : endpoint appelé
- `durationMs` : temps de traitement
- `level` : info / warn / error

### Quoi logger
- **Mutations critiques** : création commande, changement statut, paiement reçu, remboursement
- **Erreurs avec contexte complet** : stack trace + données métier
- **Performances** : requêtes DB > 500ms, appels API externes > 2s

### Quoi NE PAS logger
- Mots de passe, tokens, clés API
- Numéros de carte bancaire
- Données personnelles sensibles (au sens RGPD)

## Alertes

### Seuils recommandés
- Erreur 500 > 5 en 5 minutes → alerte immédiate
- Temps de réponse API > 3 secondes → alerte warning
- Échec webhook Stripe → alerte immédiate
- Taux d'erreur > 5% sur 15 minutes → alerte critique
- Base de données non joignable → alerte critique

### Canaux d'alerte
- Slack (canal #alertes-prod)
- Email pour les alertes critiques
- Sentry Alerts intégré

## Error Boundaries Next.js

### Structure recommandée
- `app/error.tsx` : error boundary global
- `app/(shop)/error.tsx` : error boundary pour les pages boutique
- `app/dashboard/error.tsx` : error boundary pour le dashboard boucher
- Chaque error boundary affiche un message user-friendly + bouton "Réessayer"
- Chaque error boundary envoie l'erreur à Sentry

## Ressources

| Ressource | URL |
|---|---|
| Sentry pour Next.js | https://docs.sentry.io/platforms/javascript/guides/nextjs/ |
| Setup wizard | https://docs.sentry.io/platforms/javascript/guides/nextjs/#install |
| Capturing Errors | https://docs.sentry.io/platforms/javascript/guides/nextjs/usage/ |
| Performance Monitoring | https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/ |
| Source Maps | https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/ |
| PostHog (analytics) | https://posthog.com/docs |
| BetterStack (uptime) | https://betterstack.com/docs |
