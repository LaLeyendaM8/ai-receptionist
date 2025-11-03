
---

## docs/data/rls.md

```md
# Row Level Security

**Prinzip:** Jede Zeile gehört einem `owner_user` (Supabase Auth User).  
Ein eingeloggter Nutzer sieht **nur seine eigenen Clients** und die dazugehörigen Appointments/Calls.

### Policies

**clients**
```sql
alter table public.clients enable row level security;
create policy "clients_owner_rw" on public.clients
  for all
  using (owner_user = auth.uid())
  with check (owner_user = auth.uid());

alter table public.appointments enable row level security;
create policy "appts_by_owner" on public.appointments
  for all
  using (client_id in (select id from public.clients where owner_user = auth.uid()))
  with check (client_id in (select id from public.clients where owner_user = auth.uid()));

alter table public.calls enable row level security;
create policy "calls_by_owner" on public.calls
  for all
  using (client_id in (select id from public.clients where owner_user = auth.uid()))
  with check (client_id in (select id from public.clients where owner_user = auth.uid()));

