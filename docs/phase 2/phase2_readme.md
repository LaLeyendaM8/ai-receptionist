# Phase 2 – Tech Basis

## 🎯 Ziel
AI-Rezeptionist kann eingehende Anrufe annehmen, verstehen, mit GPT antworten und per ElevenLabs sprechen.

---

## 🔧 Setup-Komponenten

### 1️⃣ Twilio Integration
- Telefonnummer erstellen  
- Webhook: `/api/call`  
- Empfängt Audio-Stream → sendet an Whisper  

### 2️⃣ OpenAI Whisper
- Speech-to-Text  
- Transkription des Gesprächs in Echtzeit oder nach Abschluss  

### 3️⃣ GPT-4 Logik
- Prompt: „Du bist die freundliche Rezeptionistin von [Unternehmen]“  
- Analysiert Kundensätze (Termin, Öffnungszeiten etc.)  

### 4️⃣ ElevenLabs
- GPT-Text → Audioantwort (z. B. mp3)  
- Rückgabe an Twilio zur Sprachausgabe  

### 5️⃣ Simulierter Testanruf
- Lokaler Call zwischen AI & Dummy-Kunde  
- Dialog-Flow testen, Logging aktivieren  

### 6️⃣ Kalenderintegration (Vorbereitung)
- Verbindung zu Google Calendar API  
- OAuth-Test mit Dummy-Konto  

---

## ✅ Ziele am Ende von Phase 2
- Technisch funktionierender Call-Flow:  
  **Kunde spricht → AI versteht → antwortet → ggf. Termin anfragt.**
- Alle Komponenten getestet und dokumentiert.  
