import { resend } from "@/lib/notify/resend";

export async function notifyHandoff(
  to: string,
  question: string,
  phone?: string | null
) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: [to],
      subject: "Neue Anfrage über ReceptaAI",
      html: `
        <h2>Neue Kundenanfrage</h2>

        <p><strong>Telefon:</strong> ${phone ?? "Unbekannt"}</p>

        <p><strong>Nachricht:</strong></p>

        <p>${question}</p>

        <hr/>

        <p>Diese Anfrage wurde von ReceptaAI erstellt.</p>
      `,
    });

    if (error) {
      console.error("[notifyHandoff] resend error", error);
    }

    return data;
  } catch (err) {
    console.error("[notifyHandoff] failed", err);
  }
}