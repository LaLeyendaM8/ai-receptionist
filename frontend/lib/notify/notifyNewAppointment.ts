import { resend } from "@/lib/notify/resend";

export async function notifyNewAppointment(params: {
  to: string;
  service: string;
  date: string;
  time: string;
  customerName?: string | null;
  phone?: string | null;
  staff?: string | null;
}) {
  const { to, service, date, time, customerName, phone, staff } = params;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: [to],
      subject: "Neuer Termin über ReceptaAI",
      html: `
        <h2>Neuer Termin</h2>

        <p><strong>Service:</strong> ${service}</p>
        <p><strong>Datum:</strong> ${date}</p>
        <p><strong>Uhrzeit:</strong> ${time}</p>

        <hr/>

        <p><strong>Kunde:</strong> ${customerName ?? "Unbekannt"}</p>
        <p><strong>Telefon:</strong> ${phone ?? "Unbekannt"}</p>
        <p><strong>Mitarbeiter:</strong> ${staff ?? "-"}</p>

        <hr/>

        <p>Termin wurde automatisch durch ReceptaAI erstellt.</p>
      `,
    });

    if (error) {
      console.error("[notifyNewAppointment] resend error", error);
    }

    return data;
  } catch (err) {
    console.error("[notifyNewAppointment] failed", err);
  }
}