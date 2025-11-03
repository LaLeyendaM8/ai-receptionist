# Environment Variablen

> **Hinweis:** `NEXT_PUBLIC_*` ist bewusst im Client sichtbar. Alles andere nur serverseitig verwenden.

| Key | Sichtbar | Zweck |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Client | Supabase Projekt-URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Client | Supabase Anon Key (RLS aktiv) |
| OPENAI_API_KEY | Server | LLM/Whisper |
| TWILIO_ACCOUNT_SID | Server | Telefonie-Backend |
| TWILIO_AUTH_TOKEN | Server | Telefonie-Backend |
| ELEVENLABS_API_KEY | Server | TTS |
| GOOGLE_CLIENT_ID | Server | OAuth für Calendar |
| GOOGLE_CLIENT_SECRET | Server | OAuth für Calendar |
| STRIPE_SECRET_KEY | Server | Subscriptions |
| RESEND_API_KEY | Server | E-Mails (optional) |

**Konventionen**
- Keine Quotes, keine Spaces: `KEY=value`
- Bei Änderungen: Dev-Server neu starten
