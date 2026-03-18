import type { FaqContext, FaqEntry, FaqService, FaqBusinessHours } from "@/lib/callflow/flows/faq/context";

export type FaqMatchResult =
  | {
      matched: true;
      type:
        | "business_hours"
        | "service_price"
        | "service_duration"
        | "service_exists"
        | "address"
        | "phone"
        | "email"
        | "custom_faq";
      answer: string;
      confidence: number;
    }
  | {
      matched: false;
    };

function normalize(text: string) {
  return (text || "")
    .trim()
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ");
}

function tokenize(text: string) {
  return normalize(text).split(" ").filter(Boolean);
}

function weekdayLabel(weekday: number) {
  const map: Record<number, string> = {
    0: "Sonntag",
    1: "Montag",
    2: "Dienstag",
    3: "Mittwoch",
    4: "Donnerstag",
    5: "Freitag",
    6: "Samstag",
  };
  return map[weekday] ?? `Tag ${weekday}`;
}

function formatMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatBusinessHours(rows: FaqBusinessHours[]) {
  if (!rows.length) return "Die Öffnungszeiten sind aktuell nicht hinterlegt.";

  const ordered = [...rows].sort((a, b) => a.weekday - b.weekday);

  const lines = ordered.map((row) => {
    if (row.is_closed) {
      return `${weekdayLabel(row.weekday)} geschlossen`;
    }

    return `${weekdayLabel(row.weekday)} ${formatMinutes(row.open_min)} bis ${formatMinutes(
      row.close_min
    )}`;
  });

  return `Die Öffnungszeiten sind: ${lines.join(", ")}.`;
}

function scoreService(text: string, service: FaqService) {
  const input = normalize(text);
  const name = normalize(service.title);

  if (!input || !name) return 0;
  if (input.includes(name)) return 1;
  if (name.includes(input) && input.length >= 4) return 0.88;

  const inputTokens = tokenize(input);
  const serviceTokens = tokenize(name);
  const overlap = inputTokens.filter((t) => serviceTokens.includes(t)).length;

  if (!overlap) return 0;

  return overlap / serviceTokens.length;
}

function findBestService(text: string, services: FaqService[]) {
  let best: FaqService | null = null;
  let bestScore = 0;

  for (const service of services) {
    const score = scoreService(text, service);
    if (score > bestScore) {
      best = service;
      bestScore = score;
    }
  }

  if (!best || bestScore < 0.55) return null;
  return { service: best, score: bestScore };
}

function looksLikeBusinessHours(text: string) {
  const t = normalize(text);
  return [
    "öffnungszeiten",
    "oeffnungszeiten",
    "wann habt ihr offen",
    "wann haben sie offen",
    "habt ihr heute offen",
    "habt ihr morgen offen",
    "wann geöffnet",
    "wann geoeffnet",
    "wann offen",
    "wann zu",
  ].some((p) => t.includes(p));
}

function looksLikePrice(text: string) {
  const t = normalize(text);
  return ["preis", "preise", "kosten", "wie viel kostet", "was kostet"].some((p) =>
    t.includes(p)
  );
}

function looksLikeDuration(text: string) {
  const t = normalize(text);
  return ["wie lange", "dauer", "wie lang", "wie viel zeit"].some((p) =>
    t.includes(p)
  );
}

function looksLikeServiceExistence(text: string) {
  const t = normalize(text);
  return [
    "habt ihr",
    "haben sie",
    "bietet ihr",
    "bieten sie",
    "gibt es",
    "macht ihr",
    "machen sie",
  ].some((p) => t.includes(p));
}

function looksLikeAddress(text: string) {
  const t = normalize(text);
  return ["adresse", "wo seid ihr", "wo sind sie", "wo befindet ihr euch", "standort"].some((p) =>
    t.includes(p)
  );
}

function looksLikePhone(text: string) {
  const t = normalize(text);
  return ["telefon", "telefonnummer", "nummer", "anrufen", "rufnummer"].some((p) =>
    t.includes(p)
  );
}

function looksLikeEmail(text: string) {
  const t = normalize(text);
  return ["email", "e mail", "mail", "kontaktadresse"].some((p) => t.includes(p));
}

function looksLikeWebsite(text: string) {
  const t = normalize(text);
  return ["website", "webseite", "homepage", "internetseite"].some((p) =>
    t.includes(p)
  );
}

function scoreFaq(text: string, faq: FaqEntry) {
  const input = tokenize(text);
  const questionTokens = tokenize(faq.question);

  if (!input.length || !questionTokens.length) return 0;

  const overlap = input.filter((t) => questionTokens.includes(t)).length;
  if (!overlap) return 0;

  return overlap / questionTokens.length;
}

function findBestFaq(text: string, faqs: FaqEntry[]) {
  let best: FaqEntry | null = null;
  let bestScore = 0;

  for (const faq of faqs) {
    const score = scoreFaq(text, faq);
    if (score > bestScore) {
      best = faq;
      bestScore = score;
    }
  }

  if (!best || bestScore < 0.4) return null;
  return { faq: best, score: bestScore };
}

export function matchFaq(text: string, ctx: FaqContext): FaqMatchResult {
  if (looksLikeBusinessHours(text)) {
    return {
      matched: true,
      type: "business_hours",
      answer: formatBusinessHours(ctx.businessHours),
      confidence: 0.97,
    };
  }

  const bestService = findBestService(text, ctx.services);

  if (bestService && looksLikePrice(text)) {
    const price = bestService.service.price_cents;
    return {
      matched: true,
      type: "service_price",
      answer:
        price != null
          ? `${bestService.service.title} kostet ${price / 100} Euro.`
          : `Für ${bestService.service.title} ist aktuell kein Preis hinterlegt.`,
      confidence: Math.min(0.98, bestService.score),
    };
  }

  if (bestService && looksLikeDuration(text)) {
    const duration = bestService.service.duration_min;
    return {
      matched: true,
      type: "service_duration",
      answer:
        duration != null
          ? `${bestService.service.title} dauert ungefähr ${duration} Minuten.`
          : `Für ${bestService.service.title} ist aktuell keine Dauer hinterlegt.`,
      confidence: Math.min(0.98, bestService.score),
    };
  }

  if (bestService && looksLikeServiceExistence(text)) {
    return {
      matched: true,
      type: "service_exists",
      answer: `Ja, ${bestService.service.title} bieten wir an.`,
      confidence: Math.min(0.95, bestService.score),
    };
  }

  if (looksLikeAddress(text) && ctx.client?.address) {
    return {
      matched: true,
      type: "address",
      answer: `Die Adresse ist ${ctx.client.address}.`,
      confidence: 0.95,
    };
  }

  if (looksLikePhone(text) && ctx.client?.phone) {
    return {
      matched: true,
      type: "phone",
      answer: `Die Telefonnummer ist ${ctx.client.phone}.`,
      confidence: 0.95,
    };
  }

  if (looksLikeEmail(text) && ctx.client?.email) {
    return {
      matched: true,
      type: "email",
      answer: `Die E-Mail-Adresse ist ${ctx.client.email}.`,
      confidence: 0.95,
    };
  }


  const bestFaq = findBestFaq(text, ctx.faqs);
  if (bestFaq) {
    return {
      matched: true,
      type: "custom_faq",
      answer: bestFaq.faq.answer,
      confidence: Math.min(0.9, bestFaq.score),
    };
  }

  return { matched: false };
}