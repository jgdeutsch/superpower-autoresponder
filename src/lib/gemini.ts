import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateReply(
  emailFrom: string,
  emailSubject: string,
  emailBody: string,
  instructions: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are an email auto-responder. Write a reply to the following email based on the instructions.

FROM: ${emailFrom}
SUBJECT: ${emailSubject}
BODY:
${emailBody}

INSTRUCTIONS FOR REPLY:
${instructions}

Write ONLY the reply body text. Do not include subject lines, greetings headers, or signatures unless the instructions say to. Be concise and professional.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
