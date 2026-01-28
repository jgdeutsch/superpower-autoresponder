export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: Condition[];
  replyInstructions: string;
  createdAt: string;
}

export interface Condition {
  field: "from" | "subject" | "body";
  operator: "contains" | "equals" | "startsWith" | "regex";
  value: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  emailFrom: string;
  emailSubject: string;
  ruleId: string;
  ruleName: string;
  replySent: string;
  status: "sent" | "error";
  error?: string;
}
