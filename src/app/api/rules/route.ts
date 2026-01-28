import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRules, saveRules } from "@/lib/store";
import type { Rule } from "@/lib/types";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rules = await getRules();
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rule: Rule = await req.json();
  rule.id = crypto.randomUUID();
  rule.createdAt = new Date().toISOString();

  const rules = await getRules();
  rules.push(rule);
  await saveRules(rules);
  return NextResponse.json(rule);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updated: Rule = await req.json();
  const rules = await getRules();
  const idx = rules.findIndex((r) => r.id === updated.id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  rules[idx] = updated;
  await saveRules(rules);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const rules = await getRules();
  await saveRules(rules.filter((r) => r.id !== id));
  return NextResponse.json({ ok: true });
}
