import { google } from "googleapis";

export function getGmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

export function getGmailClientFromRefresh(refreshToken: string) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth });
}

export async function getTodaysUnansweredMessages(
  gmail: ReturnType<typeof google.gmail>,
  maxResults = 50
) {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = today.getUTCMonth() + 1;
  const dd = today.getUTCDate();
  const dateStr = `${yyyy}/${mm}/${dd}`;

  // Get today's inbox emails not sent by me
  const res = await gmail.users.messages.list({
    userId: "me",
    q: `in:inbox after:${dateStr} -from:me`,
    maxResults,
  });
  const messages = res.data.messages ?? [];

  // Filter out messages that already have a reply from us in the thread
  const unanswered: { id: string }[] = [];
  for (const msg of messages) {
    const thread = await gmail.users.threads.get({
      userId: "me",
      id: msg.threadId!,
      format: "metadata",
      metadataHeaders: ["From"],
    });
    const threadMessages = thread.data.messages ?? [];
    const weReplied = threadMessages.some((m) => {
      const fromHeader = m.payload?.headers?.find(
        (h) => h.name?.toLowerCase() === "from"
      )?.value ?? "";
      return fromHeader.includes("jeff@superpower.com");
    });
    if (!weReplied) {
      unanswered.push({ id: msg.id! });
    }
  }
  return unanswered;
}

export async function getMessageDetails(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string
) {
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = res.data.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    "";

  let body = "";
  const payload = res.data.payload;
  if (payload?.body?.data) {
    body = Buffer.from(payload.body.data, "base64").toString("utf-8");
  } else if (payload?.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
    }
  }

  return {
    id: res.data.id!,
    threadId: res.data.threadId!,
    messageId: getHeader("Message-ID") || getHeader("Message-Id"),
    references: getHeader("References"),
    from: getHeader("From"),
    to: getHeader("To"),
    subject: getHeader("Subject"),
    date: getHeader("Date"),
    body,
    labelIds: res.data.labelIds ?? [],
  };
}

export async function sendReply(
  gmail: ReturnType<typeof google.gmail>,
  threadId: string,
  to: string,
  subject: string,
  body: string,
  inReplyToMessageId?: string,
  existingReferences?: string
) {
  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
  // Build References: existing references + the message we're replying to
  const refs = [existingReferences, inReplyToMessageId].filter(Boolean).join(" ");
  const rawParts = [
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${inReplyToMessageId ?? ""}`,
    `References: ${refs}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    body,
  ];
  const raw = Buffer.from(rawParts.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId },
  });
}

export async function markAsRead(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string
) {
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}
