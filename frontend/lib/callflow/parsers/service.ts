export type ServiceCandidate = {
  id: string;
  title: string;
  duration_min?: number | null;
  price_cents?: number | null;
};

export type ServiceParseResult = {
  value: ServiceCandidate | null;
  confidence: number;
  raw: string;
};

function normalize(text: string) {
  return (text || "")
    .trim()
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ");
}

function tokenize(text: string) {
  return normalize(text)
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean);
}

function scoreService(text: string, service: ServiceCandidate) {
  const input = normalize(text);
  const serviceName = normalize(service.title);

  if (!input || !serviceName) return 0;

  if (input === serviceName) return 1;
  if (input.includes(serviceName)) return 0.95;
  if (serviceName.includes(input) && input.length >= 4) return 0.88;

  const inputTokens = tokenize(input);
  const serviceTokens = tokenize(serviceName);

  const matches = inputTokens.filter((token) => serviceTokens.includes(token));
  if (matches.length === 0) return 0;

  return matches.length / serviceTokens.length;
}

export function parseService(args: {
  text: string;
  services: ServiceCandidate[];
}): ServiceParseResult {
  const { text, services } = args;
  const raw = text || "";

  if (!raw.trim() || !services?.length) {
    return { value: null, confidence: 0, raw };
  }

  let best: ServiceCandidate | null = null;
  let bestScore = 0;

  for (const service of services) {
    const score = scoreService(raw, service);
    if (score > bestScore) {
      best = service;
      bestScore = score;
    }
  }

  if (!best || bestScore < 0.55) {
    return { value: null, confidence: 0, raw };
  }

  return {
    value: best,
    confidence: Math.min(0.98, bestScore),
    raw,
  };
}