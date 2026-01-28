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

export async function getRecentUnreadMessages(
  gmail: ReturnType<typeof google.gmail>,
  maxResults = 10
) {
  const res = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread is:inbox",
    maxResults,
  });
  return res.data.messages ?? [];
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
