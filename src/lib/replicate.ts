// src/lib/replicate.ts — Replicate client singleton
import Replicate from "replicate";

let _client: Replicate | null = null;

export function getReplicateClient(): Replicate {
  if (!_client) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error("REPLICATE_API_TOKEN not set");
    _client = new Replicate({ auth: token });
  }
  return _client;
}
