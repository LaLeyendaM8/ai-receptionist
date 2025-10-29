# 🤖 AI-Receptionist

**Der digitale Telefon-Assistent für kleine Unternehmen.**  
AI-Receptionist nimmt Anrufe automatisch entgegen, beantwortet häufige Fragen und bucht Termine direkt in den Kalender — damit kein Anruf mehr verloren geht.

---

## 🧭 Ziel des Projekts
In **8–10 Wochen** soll ein MVP (Minimum Viable Product) entstehen, das:

- eingehende Anrufe mit **Twilio** empfängt  
- Sprache in Text umwandelt (**OpenAI Whisper**)  
- Inhalte versteht und passend reagiert (**GPT-4 Turbo**)  
- Antworten per Stimme wiedergibt (**ElevenLabs TTS**)  
- Termine im **Google Calendar** des Unternehmens speichert  
- alle Gesprächsdaten in **Supabase** protokolliert  

---

## 🧰 Tech-Stack
| Kategorie | Technologie |
|------------|-------------|
| Frontend | Next.js 14 (App Router), TailwindCSS |
| Backend | Node.js / API Routes |
| Datenbank & Auth | Supabase |
| Voice / Telephony | Twilio |
| Speech-to-Text | OpenAI Whisper API |
| Language Model | GPT-4 Turbo |
| Text-to-Speech | ElevenLabs API |
| Kalender | Google Calendar API |
| Payments | Stripe Subscriptions |

---

## 🗂️ Projektstruktur
ai-receptionist/
│
├── /frontend → Landingpage & Dashboard
├── /backend → API-Routen, Server-Logik
├── /ai → Prompts, Call-Flow, Model-Logic
├── /database → Supabase Schema & SQL-Scripts
├── /docs → Roadmap & Projekt-Doku
└── /assets → Logos & Brand-Material