
---

## docs/api/plan.md

```md
# API Plan (MVP)

## Clients
- GET `/api/clients` – Liste (RLS-filtered)
- POST `/api/clients` – neuen Client anlegen (nur Owner)

## Appointments
- GET `/api/appointments?from=&to=`
- POST `/api/appointments` – Termin anlegen
- PATCH `/api/appointments/:id` – Status ändern (cancel/reschedule)

## Calls
- GET `/api/calls?from=&to=&outcome=`
- POST `/api/calls` – Log anlegen (wird später vom Call-Flow genutzt)

**Auth:** Supabase Auth (Bearer) / Session  
**Format:** JSON, ISO-8601 für Zeiten (UTC)
