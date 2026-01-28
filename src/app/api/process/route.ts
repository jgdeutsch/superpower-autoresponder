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
    return NextResponse.json({ error: "No refresh token available" }, { status: 400 });
  }

  const gmail = getGmailClientFromRefresh(refreshToken);
  const rules = await getRules();
  const enabledRules = rules.filter((r) => r.enabled);

  if (enabledRules.length === 0) {
    return NextResponse.json({ message: "No enabled rules", processed: 0 });
  }

  const messages = await getRecentUnreadMessages(gmail, 20);
  let processed = 0;

  for (const msg of messages) {
    try {
      const email = await getMessageDetails(gmail, msg.id!);

      if (email.from.includes("jeff@superpower.com")) continue;

      for (const rule of enabledRules) {
        if (emailMatchesRule(rule, email)) {
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
    }
  }

  return NextResponse.json({ message: "Done", processed });
}
