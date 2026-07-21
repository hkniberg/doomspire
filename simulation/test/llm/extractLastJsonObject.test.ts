import { extractLastJsonObject } from "@/llm/jsonExtraction";

// Regression tests for the JSON extraction fallback. In the 2026-07-19 playtest,
// self-correcting model responses ("Wait - that JSON had a typo. Correcting: {...}")
// contained multiple JSON objects, and naive first-"{" to last-"}" extraction merged
// the drafts into junk. The last balanced object is the model's final answer.
describe("extractLastJsonObject", () => {
  test("returns a single plain object", () => {
    expect(extractLastJsonObject('{"a": 1}')).toBe('{"a": 1}');
  });

  test("prefers the last object when a draft is followed by a correction", () => {
    const text = '{"actionType": "championAction", "championId": 1} Wait - that had a typo. Correcting: {"actionType": "championAction", "championId": 2}';
    expect(extractLastJsonObject(text)).toBe('{"actionType": "championAction", "championId": 2}');
  });

  test("handles nested objects", () => {
    const text = 'some prose {"a": {"b": {"c": 3}}, "d": 4} trailing prose';
    expect(extractLastJsonObject(text)).toBe('{"a": {"b": {"c": 3}}, "d": 4}');
  });

  test("ignores braces inside string values", () => {
    const text = '{"reasoning": "move to tile {4,4} and stop", "value": 1}';
    expect(extractLastJsonObject(text)).toBe('{"reasoning": "move to tile {4,4} and stop", "value": 1}');
  });

  test("handles escaped quotes inside strings", () => {
    const text = '{"reasoning": "he said \\"attack\\" so I did", "value": 2}';
    expect(extractLastJsonObject(text)).toBe(text);
  });

  test("returns null when there is no JSON", () => {
    expect(extractLastJsonObject("no json here")).toBeNull();
  });

  test("returns null for a truncated (unbalanced) object", () => {
    expect(extractLastJsonObject('{"a": 1, "b": {"c":')).toBeNull();
  });

  test("returns the last complete object when a later one is truncated", () => {
    const text = '{"a": 1} then it broke: {"b": 2';
    expect(extractLastJsonObject(text)).toBe('{"a": 1}');
  });
});
