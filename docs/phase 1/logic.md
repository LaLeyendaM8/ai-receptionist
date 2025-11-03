# Buchungslogik (MVP)

## Terminlogik
- KI schlägt verfügbare Slots aus Kalender vor.
- Standard: nur Termine ab +24 Stunden.
- Feld `allow_same_day_bookings` in `clients.settings`.
- Wenn Kunde Termin < 24h wünscht → Weiterleitung an Mensch (Twilio Call-Transfer).

## Sicherheitslogik
- Wenn KI-Confidence < 0.7 → Transfer to human.
- Wenn kein passender Slot → Voicemail mit Kundenname + Wunschtermin aufnehmen.
- Wenn Slot akzeptiert → Termin in Supabase + Google Calendar schreiben.

## Branchenfokus
- MVP: Friseure, Nagelstudios, Kosmetik, Wellness.
- Ärzte: geplanter Ausbau (erfordert medizinische Datenprüfung + DSGVO-Erweiterung).
