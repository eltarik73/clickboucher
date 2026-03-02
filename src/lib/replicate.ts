// src/lib/replicate.ts — Replicate client singleton
import Replicate from "replicate";

let _client: Replicate | null = null;

export function isReplicateConfigured(): boolean {
  return !!process.env.REPLICATE_API_TOKEN;
}

export function getReplicateClient(): Replicate {
  if (!_client) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error("REPLICATE_API_TOKEN_MISSING");
    _client = new Replicate({ auth: token });
  }
  return _client;
}
