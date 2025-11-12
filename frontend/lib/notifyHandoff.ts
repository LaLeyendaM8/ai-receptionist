// lib/notifyHandoff.ts
// Aktuell nur Stub: loggt Handoffs, sendet aber noch keine echte E-Mail.

export async function notifyHandoff(to: string, question: string) {
  console.log("[notifyHandoff] would send email to:", to);
  console.log("[notifyHandoff] question:", question);
}
