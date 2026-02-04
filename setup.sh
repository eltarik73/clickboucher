#!/usr/bin/env bash
# ═══════════════════════════════════════════════
# ClickBoucher — Script d'installation locale
# Usage: chmod +x setup.sh && ./setup.sh
# ═══════════════════════════════════════════════

set -e

echo "🥩 ClickBoucher — Installation locale"
echo "═══════════════════════════════════════"
echo ""

# ── 1. Check prerequisites ────────────────────
echo "1️⃣  Vérification des prérequis..."

if ! command -v node &> /dev/null; then
  echo "❌ Node.js non trouvé. Installez Node.js 18+ (https://nodejs.org)"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js $NODE_VERSION détecté. Version 18+ requise."
  exit 1
fi
echo "   ✅ Node.js $(node -v)"

if ! command -v npm &> /dev/null; then
  echo "❌ npm non trouvé."
  exit 1
fi
echo "   ✅ npm $(npm -v)"

# ── 2. Install dependencies ──────────────────
echo ""
echo "2️⃣  Installation des dépendances..."
npm install
echo "   ✅ Dépendances installées"

# ── 3. Environment ────────────────────────────
echo ""
echo "3️⃣  Configuration de l'environnement..."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "   ✅ .env créé depuis .env.example"
  echo ""
  echo "   ⚠️  IMPORTANT : Configurez DATABASE_URL dans .env"
  echo "   💡 Pour PostgreSQL local avec Docker :"
  echo "      docker compose up -d"
  echo "      DATABASE_URL=\"postgresql://clickboucher:clickboucher_dev@localhost:5432/clickboucher?schema=public\""
else
  echo "   ✅ .env déjà existant"
fi

# ── 4. Database ───────────────────────────────
echo ""
echo "4️⃣  Base de données..."
echo "   Génération du client Prisma..."
npx prisma generate
echo "   ✅ Client Prisma généré"

echo ""
read -p "   Lancer les migrations et le seed ? (o/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Oo]$ ]]; then
  echo "   Migration..."
  npx prisma migrate dev --name init
  echo "   ✅ Migration appliquée"

  echo "   Seed (données de demo)..."
  npx prisma db seed
  echo "   ✅ Données de demo insérées"
fi

# ── 5. Done ───────────────────────────────────
echo ""
echo "═══════════════════════════════════════"
echo "🎉 Installation terminée !"
echo ""
echo "Commandes utiles :"
echo "  npm run dev          Lancer en développement"
echo "  npm run build        Build production"
echo "  npm run start        Lancer la build"
echo "  npx prisma studio    Visualiser la DB"
echo ""
echo "URLs :"
echo "  Client : http://localhost:3000/decouvrir"
echo "  Boucher: http://localhost:3000/dashboard/commandes"
echo "  API    : http://localhost:3000/api/health"
echo "  Prisma : http://localhost:5555 (prisma studio)"
echo "═══════════════════════════════════════"
