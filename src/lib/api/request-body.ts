// src/lib/api/request-body.ts — lecture du corps JSON d'une requête entrante.

/**
 * The request body is not JSON (malformed, truncated or empty). It is the caller's mistake, not a
 * server failure: handleApiError answers 400 VALIDATION_ERROR and neither logs nor reports it.
 */
export class InvalidJsonBodyError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("Le corps de la requête n'est pas du JSON valide", options);
    this.name = "InvalidJsonBodyError";
  }
}

/**
 * Parsed JSON body of `req`. Only a parse failure becomes an InvalidJsonBodyError; any other error
 * (body already read, connection aborted) is rethrown as is and stays a server error.
 *
 * handleApiError recognises this error class, not SyntaxError: a SyntaxError thrown anywhere else
 * (JSON.parse of stored data, a RegExp) is a server bug and must stay a 500.
 */
export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch (error) {
    if (error instanceof SyntaxError) throw new InvalidJsonBodyError({ cause: error });
    throw error;
  }
}
