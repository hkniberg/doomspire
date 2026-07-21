/**
 * Extract the last balanced top-level JSON object from a text.
 *
 * When the model self-corrects mid-response (e.g. "Wait - that JSON had a typo. Correcting: {...}"),
 * the text can contain several JSON objects. The last one is the model's final answer, so prefer it
 * over naive first-"{" to last-"}" extraction (which would merge the drafts into one junk object).
 * Returns null if no balanced object is found (e.g. the response was truncated mid-object).
 */
export function extractLastJsonObject(text: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  let lastObject: string | null = null;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    // Only track strings inside an object; quotes in surrounding prose don't matter
    if (char === '"' && depth > 0) {
      inString = true;
    } else if (char === "{") {
      if (depth === 0) {
        start = i;
      }
      depth++;
    } else if (char === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start !== -1) {
        lastObject = text.substring(start, i + 1);
      }
    }
  }

  return lastObject;
}
