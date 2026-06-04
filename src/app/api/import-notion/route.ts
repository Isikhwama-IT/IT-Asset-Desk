import { NextResponse } from "next/server";
import { importNotionObjectives } from "@/lib/actions";

export async function POST() {
  const result = await importNotionObjectives();
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ created: result.created });
}
