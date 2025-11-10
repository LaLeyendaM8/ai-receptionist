# Phase 2 – Tech-Basis & Telefon-/Kalender-Demo

## Überblick
Diese Phase liefert eine funktionsfähige Demo-Pipeline:
Twilio WebRTC → Whisper STT → Mini-Intent → ElevenLabs TTS  
sowie Google Calendar OAuth inkl. UI zum Testen.

## Endpunkte & Seiten

- /webrtc-call – WebRTC Test (Twilio)
- /api/voice-intent – Whisper STT
- /api/speak – ElevenLabs TTS
- /api/google/oauth/start – Google OAuth Start
- /api/google/oauth/callback – Google OAuth Callback
- /api/google/auth-status – Verbunden-Status
- /calendar-test – UI: Login, Google verbinden, Test-Event

## ENV
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URL=https://<>.lt/api/google/oauth/callback
GOOGLE_SCOPES=https://www.googleapis.com/auth/calendar

PUBLIC_BASE_URL=https://<>.lt
ENABLE_TEST=true
DEV_USER_ID=e9d34514-e581-4778-a276-f062d879eec1   # nur lokal

## DB

Tabelle `google_tokens`  
Spalten:  
`user_id`, `access_token`, `refresh_token`, `expiry_date`, `token_type`, `scope`, `updated_at`

RLS:  
Der Nutzer darf nur seine eigene Zeile lesen oder schreiben.

---

## Test-Plan

1. **Server starten**  
   ```bash
   npm run dev
   # ggf. Tunnel aktivieren:
   npx localtunnel --port 3000
.env.local mit aktueller lt-Domain updaten und Server neu starten

2. Google verbinden:
/calendar-test öffnen → Button Google verbinden →
Rückleitung nach Login prüfen → Status sollte verbunden sein

3. Test-Event anlegen:
Button Test-Event anlegen klicken →
im Google-Kalender überprüfen, ob Termin erstellt wurde

4. Telefon-Demo testen:
/webrtc-call öffnen → Testanruf durchführen →
prüfen, ob Speech-to-Text (Whisper) & Text-to-Speech (ElevenLabs) funktionieren

## Hinweise für PROD

DEV_USER_ID entfernen (nur für lokale Tests)

PUBLIC_BASE_URL & GOOGLE_OAUTH_REDIRECT_URL auf Produktionsdomain anpassen

API Keys & Secrets in sicheren Secrets-Storage verschieben

TTS/STT Quoten & Fehlerbehandlung in Phase 3 härten

Google Calendar Tokens regelmäßig refreshen
