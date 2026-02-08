import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  _context: { params: { id: string } }
) {
  return NextResponse.json(
    { error: "Not implemented - schema migration pending" },
    { status: 501 }
  );
}
