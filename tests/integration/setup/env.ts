// Fichier de setup du projet Vitest `integration` : s'exécute dans chaque worker avant le fichier
// de test, donc avant tout import applicatif (@/lib/prisma construit son client à partir de
// DATABASE_URL). Les deux variables sont posées : sans DIRECT_DATABASE_URL explicite, Prisma irait
// la chercher dans un fichier .env.
import { integrationDatabaseUrl } from "./database-url";

const url = integrationDatabaseUrl(process.env.DATABASE_URL);

process.env.DATABASE_URL = url;
process.env.DIRECT_DATABASE_URL = url;
