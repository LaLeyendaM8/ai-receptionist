import { resend } from "@/lib/notify/resend";

export async function notifyHandoff(params: {
  to: string;
  question: string;
  customerName?: string | null;
  customerPhone?: string | null;
}) {
  const { to, question, customerName, customerPhone } = params;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: [to],
      subject: "Neue Kundenanfrage über ReceptaAI",
      html: `
        <h2>Neue Kundenanfrage</h2>

        <p><strong>Name:</strong> ${customerName ?? "Unbekannt"}</p>
        <p><strong>Telefon:</strong> ${customerPhone ?? "Unbekannt"}</p>

        <hr/>

        <p><strong>Anliegen:</strong></p>
        <p>${question}</p>

        <hr/>

        <p>Diese Anfrage wurde automatisch von ReceptaAI erstellt.</p>
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