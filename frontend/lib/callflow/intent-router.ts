import type {
  AppointmentState,
  HandoffState,
  IntentRoute,
} from "@/lib/callflow/types";

function normalize(text: string) {
  return (text || "").trim().toLowerCase();
}

function appointmentStateIsOpen(state?: AppointmentState | null) {
  if (!state) return false;

  return Boolean(
    state.mode ||
      state.draftId ||
      state.date ||
      state.time ||
      state.serviceName ||
      state.customerName ||
      state.staffName
  );
}

function looksLikeFaqInterruption(text: string) {
  const t = normalize(text);

  const faqSignals = [
    "wann habt ihr",
    "wann haben sie",
    "wie lange",
    "was kostet",
    "welche leistungen",
    "welche services",
    "wo seid ihr",
    "wo sind sie",
    "adresse",
    "telefonnummer",
    "email",
    "e-mail",
    "öffnungszeiten",
    "habt ihr offen",
    "haben sie offen",
    "preis",
    "preise",
  ];

  return faqSignals.some((p) => t.includes(p));
}

function looksLikeAppointment(text: string) {
  const t = normalize(text);

  const signals = [
    "termin",
    "buchen",
    "vereinbaren",
    "verschieben",
    "verschiebe",
    "stornieren",
    "absagen",
    "frei",
    "verfügbar",
    "uhr",
    "morgen",
    "übermorgen",
    "nächste woche",
  ];

  return signals.some((p) => t.includes(p));
}

function looksLikeFaq(text: string) {
  const t = normalize(text);

  const signals = [
  "preis",
  "preise",
  "kosten",
  "öffnungszeiten",
  "oeffnungszeiten",
  "adresse",
  "telefon",
  "telefonnummer",
  "nummer",
  "email",
  "e-mail",
  "mail",
  "website",
  "webseite",
  "homepage",
  "wo",
  "wann",
  "welche leistungen",
  "welche services",
  "wie lange",
  "dauer",
  "bietet ihr",
  "bieten sie",
  "habt ihr",
  "haben sie",
];

  return signals.some((p) => t.includes(p));
}

function looksLikeHandoff(text: string) {
  const t = normalize(text);

  const signals = [
  "mitarbeiter",
  "mensch",
  "jemand persönlich",
  "jemand persoenlich",
  "verbinden",
  "weiterleiten",
  "echte person",
  "zurückrufen",
  "zurueckrufen",
  "rückruf",
  "rueckruf",
  "nachricht hinterlassen",
  "nachricht",
];

  return signals.some((p) => t.includes(p));
}

export function routeIntent(args: {
  text: string;
  lastIntent?: string;
  appointmentState?: AppointmentState | null;
  handoffState?: HandoffState | null;
}): IntentRoute {
  const { text, lastIntent, appointmentState, handoffState } = args;

  if (handoffState?.stage) return "handoff";

  if (
    lastIntent &&
    [
      "create_appointment",
      "cancel_appointment",
      "reschedule_appointment",
      "appointment_info",
      "availability",
      "staff_availability",
      "appointment_confirm",
      "appointment",
      "appointment_booking",
      "route_appointment",
    ].includes(lastIntent) &&
    appointmentStateIsOpen(appointmentState) &&
    !looksLikeFaqInterruption(text)
  ) {
    return "appointment";
  }

  if (looksLikeHandoff(text)) return "handoff";
  if (looksLikeAppointment(text)) return "appointment";
  if (looksLikeFaq(text)) return "faq";

  return "fallback";
}