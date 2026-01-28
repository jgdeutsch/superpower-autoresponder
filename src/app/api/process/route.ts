import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGmailClientFromRefresh, getRecentUnreadMessages, getMessageDetails, sendReply, markAsRead } from "@/lib/gmail";
import { generateReply } from "@/lib/gemini";
import { emailMatchesRule } from "@/lib/engine";
import { getRules, addLog } from "@/lib/store";
import type { LogEntry } from "@/lib/types";

// Vercel cron calls GET
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return processEmails(process.env.GMAIL_REFRESH_TOKEN);
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  const session = await auth();

  if (!session && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const refreshToken = session?.refreshToken ?? process.env.GMAIL_REFRESH_TOKEN;
  return processEmails(refreshToken);
}

async function processEmails(refreshToken: string | undefined) {
  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token available", debug: "refreshToken is undefined" }, { status: 400 });
  }

  const gmail = getGmailClientFromRefresh(refreshToken);
  const rules = await getRules();
  const enabledRules = rules.filter((r) => r.enabled);

  if (enabledRules.length === 0) {
    return NextResponse.json({ message: "No enabled rules", processed: 0 });
  }

  let messages;
  try {
    messages = await getRecentUnreadMessages(gmail, 20);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to fetch emails", detail: error }, { status: 500 });
  }

  const debug: { totalUnread: number; emails: { from: string; subject: string; skippedSelf: boolean; matchedRule: string | null }[] } = {
    totalUnread: messages.length,
    emails: [],
  };

  let processed = 0;

  for (const msg of messages) {
    try {
      const email = await getMessageDetails(gmail, msg.id!);

      const skippedSelf = email.from.includes("jeff@superpower.com");
      let matchedRule: string | null = null;

      if (!skippedSelf) {
        for (const rule of enabledRules) {
          if (emailMatchesRule(rule, email)) {
            matchedRule = rule.name;
            const replyText = await generateReply(
              email.from,
              email.subject,
              email.body,
              rule.replyInstructions
            );

            await sendReply(gmail, email.threadId, email.from, email.subject, replyText);
            await markAsRead(gmail, email.id);

            const log: LogEntry = {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              emailFrom: email.from,
              emailSubject: email.subject,
              ruleId: rule.id,
              ruleName: rule.name,
              replySent: replyText,
              status: "sent",
            };
            await addLog(log);
            processed++;
            break;
          }
        }
      }

      debug.emails.push({
        from: email.from,
        subject: email.subject,
        skippedSelf,
        matchedRule,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      await addLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        emailFrom: "unknown",
        emailSubject: "unknown",
        ruleId: "error",
        ruleName: "error",
        replySent: "",
        status: "error",
        error,
      });
      debug.emails.push({ from: "error", subject: error, skippedSelf: false, matchedRule: null });
    }
  }

  return NextResponse.json({ message: "Done", processed, debug });
}
