import { NextRequest, NextResponse } from "next/server";

export async function PATCH(_req: NextRequest) {
  return NextResponse.json(
    { error: "Not implemented - schema migration pending" },
    { status: 501 }
  );
}

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { error: "Not implemented - schema migration pending" },
    { status: 501 }
  );
}
