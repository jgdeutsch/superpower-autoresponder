import { put, list, del } from "@vercel/blob";
import type { Rule, LogEntry } from "./types";

const RULES_KEY = "rules.json";
const LOGS_KEY = "logs.json";
const STATE_KEY = "state.json";

async function readBlob<T>(key: string, fallback: T): Promise<T> {
  try {
    const { blobs } = await list({ prefix: key, limit: 1 });
    if (blobs.length === 0) return fallback;
    const res = await fetch(blobs[0].url);
    return await res.json();
  } catch {
    return fallback;
  }
}

async function writeBlob(key: string, data: unknown) {
  // Delete old blob first
  try {
    const { blobs } = await list({ prefix: key, limit: 1 });
    if (blobs.length > 0) {
      await del(blobs[0].url);
    }
  } catch {
    // ignore
  }
  await put(key, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
  });
}

export async function getRules(): Promise<Rule[]> {
  return readBlob(RULES_KEY, []);
}

export async function saveRules(rules: Rule[]) {
  await writeBlob(RULES_KEY, rules);
}

export async function getLogs(): Promise<LogEntry[]> {
  return readBlob(LOGS_KEY, []);
}

export async function addLog(entry: LogEntry) {
  const logs = await getLogs();
  logs.unshift(entry);
  if (logs.length > 200) logs.length = 200;
  await writeBlob(LOGS_KEY, logs);
}

export async function getLastProcessedHistoryId(): Promise<string | null> {
  const state = await readBlob<{ historyId?: string }>(STATE_KEY, {});
  return state.historyId ?? null;
}

export async function setLastProcessedHistoryId(historyId: string) {
  await writeBlob(STATE_KEY, { historyId });
}
