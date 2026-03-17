function normalize(text: string) {
  return (text || "")
    .trim()
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ");
}

export function looksLikeTransferRequest(text: string) {
  const t = normalize(text);

  return [
    "mitarbeiter",
    "mensch",
    "jemand persönlich",
    "jemand persoenlich",
    "echte person",
    "verbinden",
    "weiterleiten",
    "weiter verbinden",
    "kann ich mit jemandem sprechen",
    "kann ich mit einem mitarbeiter sprechen",
    "ich möchte mit jemandem sprechen",
    "ich moechte mit jemandem sprechen",
  ].some((p) => t.includes(p));
}

export function looksLikeTransferChoice(text: string) {
  const t = normalize(text);

  return [
    "verbinden",
    "weiterleiten",
    "direkt verbinden",
    "ja verbinden",
    "bitte verbinden",
  ].some((p) => t.includes(p));
}

export function looksLikeMessageChoice(text: string) {
  const t = normalize(text);

  return [
    "nachricht",
    "nachricht hinterlassen",
    "rückruf",
    "rueckruf",
    "zurückrufen",
    "zurueckrufen",
    "bitte rückruf",
    "bitte rueckruf",
  ].some((p) => t.includes(p));
}

export function looksAffirmative(text: string) {
  const t = normalize(text);

  return [
    "ja",
    "jap",
    "jo",
    "yes",
    "klar",
    "gerne",
    "okay",
    "ok",
    "passt",
    "genau",
    "stimmt",
  ].includes(t);
}

export function looksNegative(text: string) {
  const t = normalize(text);

  return [
    "nein",
    "nee",
    "ne",
    "nicht",
    "doch nicht",
    "lieber nicht",
  ].includes(t);
}

export function extractPhone(text: string) {
  let phone = (text || "").replace(/[^\d+]/g, "");

  if (!phone) return null;

  if (phone.startsWith("00")) {
    phone = `+${phone.slice(2)}`;
  }

  if (phone.startsWith("0")) {
    phone = `+49${phone.slice(1)}`;
  }

  if (!phone.startsWith("+") && phone.startsWith("49")) {
    phone = `+${phone}`;
  }

  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 10 || digits.length > 15) return null;

  return phone;
}

export function cleanName(text: string) {
  const cleaned = (text || "")
    .trim()
    .replace(/[0-9]/g, "")
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  const normalized = cleaned
    .replace(/^ich bin\s+/i, "")
    .replace(/^mein name ist\s+/i, "")
    .replace(/^hier ist\s+/i, "")
    .trim();

  if (!normalized) return null;

  return normalized
    .split(" ")
    .filter(Boolean)
    .slice(0, 4)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}