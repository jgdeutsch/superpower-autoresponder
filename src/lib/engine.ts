import type { Rule, Condition } from "./types";

export function emailMatchesRule(
  rule: Rule,
  email: { from: string; subject: string; body: string }
): boolean {
  if (!rule.enabled) return false;
  return rule.conditions.every((c) => matchCondition(c, email));
}

function matchCondition(
  condition: Condition,
  email: { from: string; subject: string; body: string }
): boolean {
  const fieldValue = email[condition.field].toLowerCase();
  const testValue = condition.value.toLowerCase();

  switch (condition.operator) {
    case "contains":
      return fieldValue.includes(testValue);
    case "equals":
      return fieldValue === testValue;
    case "startsWith":
      return fieldValue.startsWith(testValue);
    case "regex":
      try {
        return new RegExp(condition.value, "i").test(email[condition.field]);
      } catch {
        return false;
      }
    default:
      return false;
  }
}
