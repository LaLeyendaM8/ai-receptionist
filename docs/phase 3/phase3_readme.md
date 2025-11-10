
# Phase 3 – MVP Funktionalität  

## 🎯 Ziel  
Der AI-Rezeptionist kann Gespräche verstehen, Termine automatisch im Kalender eintragen, Gesprächsdaten in der Datenbank speichern und über ein Dashboard verwaltet werden.  

---

## 🔧 Setup-Komponenten  

### 1️⃣ Supabase Datenbank  
- Tabellen:  
  - **calls** → Gesprächsverläufe (Datum, Kunde, Transkript, Antwort)  
  - **appointments** → Termin-Infos (Datum, Uhrzeit, Kunde, Status)  
  - **clients** → Kundendaten (Name, Telefonnummer, Notizen)  
- Speicherung von Gesprächs-Logs und Terminen  
- Verbindung Backend ↔ Supabase über Server-Actions oder API-Routen  

---

### 2️⃣ Google Calendar Integration  
- OAuth-Setup (Projekt in Google Cloud anlegen, Client ID & Secret in .env)  
- API-Routen zum Abrufen und Erstellen von Terminen (`/api/calendar`)  
- KI trägt automatisch Termine in den Google Kalender ein  
- Synchronisierung zwischen Supabase und Google Calendar  

---

### 3️⃣ LLM-Logik (Optimierter Gesprächs-Flow)  
- Prompt-Training für:  
  - **Terminvereinbarung** (z. B. „Ich möchte am Freitag um 15 Uhr kommen“)  
  - **FAQs** (z. B. „Wie lange dauert ein Termin?“)  
  - **Weiterleitung an Mitarbeiter** bei komplizierten Anfragen  
- Verbesserte Kontextübergabe zwischen Whisper → GPT → TTS  
- Logging aller KI-Entscheidungen für Debugging  

---

### 4️⃣ Admin Dashboard (Next.js)  
- **Login / Auth:** Supabase Authentication (E-Mail + Session)  
- **Übersicht:** Letzte Anrufe, gebuchte Termine, Logs  
- **Button:** „AI aktivieren / deaktivieren“ → Status in Datenbank gespeichert  
- Minimal-UI mit Fokus auf Funktionalität und Debugging  

---

### 5️⃣ Testing & Dokumentation  
- Testgespräche mit Echt-Audio → Prüfen, ob Termine korrekt eingetragen werden  
- API-Error Handling & Fallbacks testen (Whisper / Calendar / DB)  
- Aktualisierung der README mit DB-Schema und OAuth-Setup-Schritten  

---

## ✅ Ziele am Ende von Phase 3  
- Voll funktionsfähiger MVP:  
  **Kunde spricht → AI versteht → trägt Termin in Kalender ein → Dashboard zeigt Daten.**  
- Gesprächsdaten, Termine und Logs werden in Supabase gespeichert.  
- Dashboard ermöglicht Admin-Überwachung und AI-Steuerung.  
- Grundlage für Landingpage & Beta-Tests geschaffen.  
