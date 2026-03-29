import { canonicalize, shortHash } from "./utils.js";
import type { MatchResult, StoredMock } from "./types.js";

export function buildVariantName(query: unknown, body: unknown): string {
  const q = canonicalize(query);
  const b = canonicalize(body);
  return `q_${q ? shortHash(q) : "empty"}__b_${b ? shortHash(b) : "empty"}`;
}

function objectKeys(value: unknown): Set<string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return new Set();
  return new Set(Object.keys(value as Record<string, unknown>));
}

function scoreCandidate(requestBody: unknown, candidateBody: unknown): number {
  const reqKeys = objectKeys(requestBody);
  const candKeys = objectKeys(candidateBody);
  if (reqKeys.size === 0 || candKeys.size === 0) return 0;
  let overlap = 0;
  for (const key of reqKeys) {
    if (candKeys.has(key)) overlap += 1;
  }
  return overlap / Math.max(reqKeys.size, candKeys.size);
}

export function matchMock(args: {
  exact?: StoredMock;
  variants: StoredMock[];
  defaultMock?: StoredMock;
  requestBody: unknown;
  fuzzyDisabled?: boolean;
}): MatchResult {
  if (args.exact) return { type: "exact", mock: args.exact };

  if (!args.fuzzyDisabled) {
    let best: StoredMock | undefined;
    let bestScore = 0;

    for (const v of args.variants) {
      const score = scoreCandidate(args.requestBody, v.requestSnapshot?.body);
      if (score > bestScore) {
        best = v;
        bestScore = score;
      }
    }

    if (best && bestScore >= 0.4) return { type: "fuzzy", mock: best };
  }

  if (!args.fuzzyDisabled && args.defaultMock) return { type: "default", mock: args.defaultMock };
  return { type: "miss" };
}
