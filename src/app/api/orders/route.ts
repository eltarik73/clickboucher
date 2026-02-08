import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { error: "Not implemented - schema migration pending" },
    { status: 501 }
  );
}

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Not implemented - schema migration pending" },
    { status: 501 }
  );
}
