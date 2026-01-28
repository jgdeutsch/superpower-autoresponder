import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLogs } from "@/lib/store";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const logs = await getLogs();
  return NextResponse.json(logs);
}
