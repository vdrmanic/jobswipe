# Discovery, notifikacije i safety

## Supabase migracija

U Supabase SQL Editoru pokreni ceo sadrzaj:

`supabase/migrations/202606210001_discovery_notifications_safety.sql`

Migracija dodaje:

- in-app notifikacije za match, poruke i verifikaciju;
- privatne push tokene uredjaja;
- obostrano uklanjanje blokiranih naloga iz discovery-ja;
- prijave korisnika i admin moderation red;
- RLS pravila i realtime za notifikacije.

Zatim pokreni i:

`supabase/migrations/202606210002_job_scoped_company_swipes.sql`

Ova migracija vezuje svaki swipe firme za konkretan oglas. Postojeci swipeovi
kandidata se cuvaju i automatski povezuju sa oglasom, dok se stari swipeovi
firme resetuju jer iz njih nije moguce pouzdano zakljuciti na koji oglas su se
odnosili.

Na kraju pokreni:

`supabase/migrations/202606210003_job_growth_suite.sql`

Ova migracija dodaje detalje oglasa, nacrte, pipeline kandidata, zakazivanje
intervjua, obavestenja o promeni statusa i dogadjaje potrebne za analitiku.

Admin za prijave koristi isti nalog koji postoji u `verification_admins`.

## Push notifikacije

In-app notifikacije rade odmah nakon migracije. Za stvarne push poruke na telefonu potrebno je:

1. povezati projekat sa EAS-om da `projectId` bude dostupan;
2. napraviti development ili production build (push ne radi potpuno u Expo Go);
3. serverski poslati sacuvane Expo tokene kroz Expo Push API.

Aplikacija vec trazi dozvolu i upisuje Expo push token u `device_push_tokens` kada postoji EAS `projectId`.

Edge Function za slanje je spremna u `supabase/functions/send-push-notifications`. Deploy:

```powershell
npx supabase functions deploy send-push-notifications
```
