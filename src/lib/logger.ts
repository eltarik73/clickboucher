// src/lib/logger.ts — Silent-in-prod structured logger
// Use this instead of console.log. Always use console.error for real errors.
/* eslint-disable no-console */
const isProd = process.env.NODE_ENV === "production";

export const logger = {
  debug: (...args: unknown[]) => {
    if (!isProd) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (!isProd) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
