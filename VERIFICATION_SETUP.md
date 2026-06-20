# Verifikacija radnog iskustva

## Jednokratno podesavanje

1. Otvori Supabase projekat i idi na **SQL Editor**.
2. Pokreni ceo sadrzaj fajla `supabase/migrations/202606200001_experience_verification.sql`.
3. U **Authentication > Users** kopiraj UUID naloga koji ce pregledati dokumente.
4. U SQL Editoru pokreni:

```sql
insert into public.verification_admins (user_id)
values ('OVDE-UBACI-UUID')
on conflict (user_id) do nothing;
```

Posle osvezavanja profila, na tom nalogu se pojavljuje dugme **Provera dokumenata**.

Ako je projekat povezan sa Supabase CLI-jem, umesto prvog koraka moze da se koristi:

```powershell
npx supabase db push
```

## Tok za kandidata

1. U **Profil > Izmeni profil** kandidat dodaje firmu, poziciju, period i opis iskustva.
2. Na svom profilu bira **Verifikuj iskustvo**.
3. Dodaje PDF ili fotografiju do 10 MB i salje zahtev.
4. Status postaje **Na proveri**. Posle odluke vidi **Verifikovano**, **Odbijeno** ili **Dopuna potrebna**, zajedno sa admin napomenom.
5. Kod odbijenog zahteva ili trazene dopune moze da posalje novi dokument.

Kandidat treba da prekrije JMBG, adresu, broj racuna, platu i sve sto nije potrebno za potvrdu zaposlenja.

## Tok za administratora

1. Otvori **Profil > Provera dokumenata**.
2. Otvori prilozeni dokument.
3. Izaberi **Odobri**, **Novi dokument** ili **Odbij**.
4. Za dopunu i odbijanje obavezno upisi razlog koji kandidat moze da vidi.

Firme vide samo zeleni bedz na iskustvu koje je odobreno. Ne vide dokument, naziv fajla, odbijene zahteve ni admin napomene.

Ako kandidat promeni firmu, poziciju, period ili opis, stari bedz se automatski vise ne prikazuje na izmenjenom iskustvu.

## Bezbednost

- Dokumenti su u privatnom bucket-u `experience-verification-documents`.
- Kandidat vidi samo svoje dokumente; administrator vidi dokumente za proveru.
- Javni prikaz `verified_experience_badges` izlaze samo podatke potrebne za verifikovani bedz.
- Najvise tri zahteva jednog kandidata mogu istovremeno da cekaju proveru.
