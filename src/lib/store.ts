import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { Rule, LogEntry } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const RULES_FILE = path.join(DATA_DIR, "rules.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");
const STATE_FILE = path.join(DATA_DIR, "state.json");

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const data = await readFile(file, "utf-8");
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  await ensureDir();
  await writeFile(file, JSON.stringify(data, null, 2));
}

export async function getRules(): Promise<Rule[]> {
  return readJson(RULES_FILE, []);
}

export async function saveRules(rules: Rule[]) {
  await writeJson(RULES_FILE, rules);
}

export async function getLogs(): Promise<LogEntry[]> {
  return readJson(LOGS_FILE, []);
}

export async function addLog(entry: LogEntry) {
  const logs = await getLogs();
  logs.unshift(entry);
  if (logs.length > 200) logs.length = 200;
  await writeJson(LOGS_FILE, logs);
}

export async function getLastProcessedHistoryId(): Promise<string | null> {
  const state = await readJson<{ historyId?: string }>(STATE_FILE, {});
  return state.historyId ?? null;
}

export async function setLastProcessedHistoryId(historyId: string) {
  await writeJson(STATE_FILE, { historyId });
}
