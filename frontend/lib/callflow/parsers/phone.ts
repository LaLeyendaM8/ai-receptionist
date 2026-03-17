export type PhoneParseResult = {
  value: string | null;
  confidence: number;
  raw: string;
};

function stripToPhoneChars(text: string) {
  return (text || "").replace(/[^\d+]/g, "");
}

function normalizeGermanPhone(input: string) {
  let phone = stripToPhoneChars(input);

  if (!phone) return null;

  if (phone.startsWith("00")) {
    phone = `+${phone.slice(2)}`;
  }

  if (phone.startsWith("0")) {
    phone = `+49${phone.slice(1)}`;
  }

  if (!phone.startsWith("+")) {
    if (phone.startsWith("49")) {
      phone = `+${phone}`;
    }
  }

  const digits = phone.replace(/[^\d]/g, "");

  if (digits.length < 10 || digits.length > 15) return null;

  return phone;
}

export function parsePhone(text: string): PhoneParseResult {
  const raw = text || "";
  const value = normalizeGermanPhone(raw);

  if (!value) {
    return {
      value: null,
      confidence: 0,
      raw,
    };
  }

  return {
    value,
    confidence: 0.95,
    raw,
  };
}