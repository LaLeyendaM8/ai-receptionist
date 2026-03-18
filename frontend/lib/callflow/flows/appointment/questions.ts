import type { ServiceCandidate } from "@/lib/callflow/parsers/service";

function humanDate(date?: string | null) {
  if (!date) return "dem gewünschten Tag";
  return date;
}

export function askForService() {
  return "Gerne. Für welche Leistung möchten Sie einen Termin buchen?";
}

export function askForDate(serviceName?: string | null) {
  if (serviceName) {
    return `Alles klar, für ${serviceName}. An welchem Tag möchten Sie den Termin?`;
  }

  return "An welchem Tag möchten Sie den Termin?";
}

export function askForTime(date?: string | null) {
  if (date) {
    return `Welche Uhrzeit passt Ihnen am ${humanDate(date)}?`;
  }

  return "Welche Uhrzeit passt Ihnen?";
}

export function askForName() {
  return "Auf welchen Namen soll ich den Termin eintragen?";
}

export function askForPhone() {
  return "Unter welcher Telefonnummer können wir Sie erreichen?";
}

export function askToConfirm(args: {
  serviceName?: string | null;
  date?: string | null;
  time?: string | null;
  customerName?: string | null;
}) {
  const { serviceName, date, time, customerName } = args;

  const parts = [
    serviceName ? `für ${serviceName}` : null,
    date ? `am ${date}` : null,
    time ? `um ${time}` : null,
    customerName ? `auf den Namen ${customerName}` : null,
  ].filter(Boolean);

  return `Ich habe den Termin ${parts.join(" ")} vorgemerkt. Soll ich das so bestätigen?`;
}

export function askForClarifiedService(services?: ServiceCandidate[]) {
  if (services?.length) {
    const preview = services
      .slice(0, 3)
      .map((s) => s.title)
      .join(", ");
    return `Ich habe die Leistung noch nicht ganz verstanden. Verfügbare Leistungen wären zum Beispiel ${preview}. Welche möchten Sie buchen?`;
  }

  return "Ich habe die gewünschte Leistung noch nicht ganz verstanden. Welche Leistung möchten Sie buchen?";
}

export function askForClarifiedDate() {
  return "Welchen Tag meinen Sie genau? Zum Beispiel morgen, nächsten Montag oder ein konkretes Datum.";
}

export function askForClarifiedTime() {
  return "Welche Uhrzeit meinen Sie genau? Zum Beispiel 16 Uhr oder 16 Uhr 30.";
}

export function askForClarifiedName() {
  return "Wie ist der Name für den Termin?";
}

export function bookingConfirmed(args?: {
  serviceName?: string | null;
  date?: string | null;
  time?: string | null;
}) {
  const parts = [
    args?.serviceName ? `für ${args.serviceName}` : null,
    args?.date ? `am ${args.date}` : null,
    args?.time ? `um ${args.time}` : null,
  ].filter(Boolean);

  if (parts.length) {
    return `Perfekt, Ihr Termin ${parts.join(" ")} wurde erfolgreich gebucht.`;
  }

  return "Perfekt, Ihr Termin wurde erfolgreich gebucht.";
}

export function bookingDeclined() {
  return "Alles klar. Dann passen wir den Termin an. Was möchten Sie ändern?";
}

export function askAvailabilityMissingDate() {
  return "Für welchen Tag möchten Sie die Verfügbarkeit wissen?";
}

export function askAvailabilityMissingService() {
  return "Für welche Leistung möchten Sie die Verfügbarkeit prüfen?";
}

export function availabilityAnswer(args: {
  serviceName?: string | null;
  date?: string | null;
  suggestions: string[];
}) {
  const { serviceName, date, suggestions } = args;

  if (!suggestions.length) {
    return `Für ${serviceName ?? "diese Leistung"} habe ich am ${date ?? "gewünschten Tag"} leider keine freien Zeiten gefunden.`;
  }

  const joined = suggestions.join(", ");
  return `Für ${serviceName ?? "diese Leistung"} am ${date ?? "gewünschten Tag"} wären zum Beispiel folgende Zeiten frei: ${joined}.`;
}

export function cancelSuccess(args: {
  date?: string | null;
}) {
  if (args.date) {
    return `Alles klar, Ihr Termin am ${args.date} wurde abgesagt.`;
  }

  return "Alles klar, Ihr Termin wurde abgesagt.";
}

export function cancelNotFound() {
  return "Ich konnte leider keinen passenden Termin finden. Möchten Sie stattdessen mit einem Mitarbeiter verbunden werden oder eine Nachricht hinterlassen?";
}

export function rescheduleSuccess(args: {
  date?: string | null;
  time?: string | null;
}) {
  const parts = [
    args.date ? `am ${args.date}` : null,
    args.time ? `um ${args.time}` : null,
  ].filter(Boolean);

  if (parts.length) {
    return `Alles klar, Ihr Termin wurde auf ${parts.join(" ")} verschoben.`;
  }

  return "Alles klar, Ihr Termin wurde verschoben.";
}

export function appointmentInfoAnswer(args: {
  title?: string | null;
  date?: string | null;
  time?: string | null;
}) {
  const parts = [
    args.title ? `für ${args.title}` : null,
    args.date ? `am ${args.date}` : null,
    args.time ? `um ${args.time}` : null,
  ].filter(Boolean);

  if (parts.length) {
    return `Ich habe einen Termin ${parts.join(" ")} gefunden.`;
  }

  return "Ich habe einen Termin für Sie gefunden.";
}

export function appointmentInfoNotFound() {
  return "Ich konnte aktuell keinen passenden Termin finden.";
}