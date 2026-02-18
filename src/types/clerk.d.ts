declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: "client" | "client_pro" | "client_pro_pending" | "boucher" | "admin" | "webmaster";
    };
  }
}

export {};
