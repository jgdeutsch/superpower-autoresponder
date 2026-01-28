"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { redirect } from "next/navigation";
import type { Rule, Condition, LogEntry } from "@/lib/types";

function emptyCondition(): Condition {
  return { field: "from", operator: "contains", value: "" };
}

function emptyRule(): Omit<Rule, "id" | "createdAt"> {
  return {
    name: "",
    enabled: true,
    conditions: [emptyCondition()],
    replyInstructions: "",
  };
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tab, setTab] = useState<"rules" | "logs">("rules");
  const [editing, setEditing] = useState<Omit<Rule, "id" | "createdAt"> & { id?: string } | null>(null);
  const [processing, setProcessing] = useState(false);

  const loadRules = useCallback(async () => {
    const res = await fetch("/api/rules");
    if (res.ok) setRules(await res.json());
  }, []);

  const loadLogs = useCallback(async () => {
    const res = await fetch("/api/logs");
    if (res.ok) setLogs(await res.json());
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      loadRules();
      loadLogs();
    }
  }, [status, loadRules, loadLogs]);

  if (status === "loading") return <div className="p-8">Loading...</div>;
  if (status === "unauthenticated") redirect("/");

  async function saveRule() {
    if (!editing) return;
    const method = editing.id ? "PUT" : "POST";
    await fetch("/api/rules", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setEditing(null);
    loadRules();
  }

  async function deleteRule(id: string) {
    await fetch("/api/rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadRules();
  }

  async function toggleRule(rule: Rule) {
    await fetch("/api/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rule, enabled: !rule.enabled }),
    });
    loadRules();
  }

  async function runNow() {
    setProcessing(true);
    try {
      const res = await fetch("/api/process", { method: "POST" });
      const data = await res.json();
      alert(JSON.stringify(data, null, 2));
      loadLogs();
    } catch {
      alert("Error processing emails");
    }
    setProcessing(false);
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Superpower Auto-Responder</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{session?.user?.email}</span>
          <button onClick={() => signOut()} className="text-sm text-red-400 hover:text-red-300">
            Sign out
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setTab("rules")}
          className={`px-4 py-2 rounded-lg font-medium ${tab === "rules" ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
        >
          Rules
        </button>
        <button
          onClick={() => setTab("logs")}
          className={`px-4 py-2 rounded-lg font-medium ${tab === "logs" ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
        >
          Logs
        </button>
        <button
          onClick={runNow}
          disabled={processing}
          className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg font-medium"
        >
          {processing ? "Processing..." : "Run Now"}
        </button>
      </div>

      {tab === "rules" && (
        <div className="space-y-4">
          {!editing && (
            <button
              onClick={() => setEditing(emptyRule())}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
            >
              + New Rule
            </button>
          )}

          {editing && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4">
              <input
                type="text"
                placeholder="Rule name"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg"
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Conditions (ALL must match):</label>
                {editing.conditions.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <select
                      value={c.field}
                      onChange={(e) => {
                        const conds = [...editing.conditions];
                        conds[i] = { ...c, field: e.target.value as Condition["field"] };
                        setEditing({ ...editing, conditions: conds });
                      }}
                      className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg"
                    >
                      <option value="from">From</option>
                      <option value="subject">Subject</option>
                      <option value="body">Body</option>
                    </select>
                    <select
                      value={c.operator}
                      onChange={(e) => {
                        const conds = [...editing.conditions];
                        conds[i] = { ...c, operator: e.target.value as Condition["operator"] };
                        setEditing({ ...editing, conditions: conds });
                      }}
                      className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg"
                    >
                      <option value="contains">Contains</option>
                      <option value="equals">Equals</option>
                      <option value="startsWith">Starts with</option>
                      <option value="regex">Regex</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Value"
                      value={c.value}
                      onChange={(e) => {
                        const conds = [...editing.conditions];
                        conds[i] = { ...c, value: e.target.value };
                        setEditing({ ...editing, conditions: conds });
                      }}
                      className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg"
                    />
                    {editing.conditions.length > 1 && (
                      <button
                        onClick={() => {
                          const conds = editing.conditions.filter((_, j) => j !== i);
                          setEditing({ ...editing, conditions: conds });
                        }}
                        className="px-3 py-2 text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() =>
                    setEditing({ ...editing, conditions: [...editing.conditions, emptyCondition()] })
                  }
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  + Add condition
                </button>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">
                  Reply instructions (for Gemini AI):
                </label>
                <textarea
                  rows={4}
                  placeholder="e.g., Thank them for reaching out and let them know I'll respond within 24 hours."
                  value={editing.replyInstructions}
                  onChange={(e) => setEditing({ ...editing, replyInstructions: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={saveRule} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">
                  Save
                </button>
                <button onClick={() => setEditing(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {rules.map((rule) => (
            <div key={rule.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleRule(rule)}
                    className={`w-10 h-6 rounded-full transition ${rule.enabled ? "bg-green-500" : "bg-gray-600"} relative`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition ${rule.enabled ? "left-4.5" : "left-0.5"}`}
                    />
                  </button>
                  <span className="font-medium">{rule.name}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(rule)}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-400">
                {rule.conditions.map((c, i) => (
                  <span key={i}>
                    {i > 0 && " AND "}
                    {c.field} {c.operator} &quot;{c.value}&quot;
                  </span>
                ))}
              </div>
              <div className="mt-1 text-sm text-gray-500 truncate">
                Reply: {rule.replyInstructions}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "logs" && (
        <div className="space-y-2">
          {logs.length === 0 && <p className="text-gray-500">No logs yet.</p>}
          {logs.map((log) => (
            <div
              key={log.id}
              className={`bg-gray-900 border rounded-lg p-4 ${log.status === "error" ? "border-red-700" : "border-gray-700"}`}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                <span className={log.status === "sent" ? "text-green-400" : "text-red-400"}>
                  {log.status}
                </span>
              </div>
              <div className="text-sm mt-1">
                <span className="text-gray-300">From:</span> {log.emailFrom}
              </div>
              <div className="text-sm">
                <span className="text-gray-300">Subject:</span> {log.emailSubject}
              </div>
              <div className="text-sm text-gray-500">Rule: {log.ruleName}</div>
              {log.error && <div className="text-sm text-red-400 mt-1">{log.error}</div>}
              {log.replySent && (
                <details className="mt-2">
                  <summary className="text-sm text-blue-400 cursor-pointer">View reply</summary>
                  <pre className="mt-1 text-sm text-gray-400 whitespace-pre-wrap">{log.replySent}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
