# Datenmodell

```mermaid
erDiagram
  clients ||--o{ appointments : has
  clients ||--o{ calls : has

  clients {
    uuid id PK
    text name
    text industry
    text phone
    text email
    jsonb address
    text timezone
    boolean active
    uuid owner_user
    timestamptz created_at
  }

  appointments {
    uuid id PK
    uuid client_id FK
    text title
    text customer_name
    text customer_phone
    timestamptz start_at
    timestamptz end_at
    text source  "ai|phone|web|manual"
    text status  "booked|canceled|rescheduled|no_show"
    text notes
    timestamptz created_at
  }

  calls {
    uuid id PK
    uuid client_id FK
    text direction "inbound|outbound"
    text from_number
    text to_number
    timestamptz started_at
    integer duration_seconds
    text language
    text outcome "booked|resolved|voicemail|no_answer|transferred"
    uuid booking_id
    text transcript
    jsonb meta
  }
