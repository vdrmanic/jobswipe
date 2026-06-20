# 🔄 MIGRATION GUIDE - Kako Ažurirati Postojeće Screens

Ovaj guide pokazuje kako ažurirati preostale screens da koriste novi **Service Layer**.

---

## 📋 Šta Trebate Uraditi

Svi screen-ovi trebali bi da koriste service layer umesto direktnih Supabase poziva.

### Početak Migracijom

1. **Import service-a**
```typescript
import { authService, jobService, matchService } from '../../services';
```

2. **Zameni direktne Supabase pozive**
```typescript
// ❌ LOŠE
const { data } = await supabase.from('jobs').select('*');

// ✅ DOBRO
const jobs = await jobService.fetchJobs();
```

3. **Dodaj error handling**
```typescript
// ❌ LOŠE
try {
  const { data } = await supabase.from('jobs').select('*');
} catch (error) {
  console.log(error);
}

// ✅ DOBRO
try {
  const jobs = await jobService.fetchJobs();
} catch (error) {
  const appError = handleError(error);
  Alert.alert('Greška', appError.message);
}
```

---

## 🎯 Screens za Ažuriranje

### 1. **LoginScreen.tsx**
```typescript
// Zameni:
const { error } = await signIn(email.trim(), password);

// Sa:
import { authService } from '../../services';
try {
  await authService.signIn(email.trim(), password);
} catch (error) {
  // error je već AppError instance
}
```

### 2. **RegisterScreen.tsx**
```typescript
// Zameni:
const { error: profileError } = await supabase.from('profiles').insert({...});

// Sa:
import { authService } from '../../services';
try {
  await authService.signUp(email, password, fullName, userType);
} catch (error) {
  // error je već AppError instance
}
```

### 3. **CandidateSwipeScreen.tsx**
```typescript
// Zameni:
const { data } = await supabase.from('jobs').select('*');
const { data: swipedData } = await supabase.from('swipes').select('target_id')...;

// Sa:
import { jobService, swipeService } from '../../services';
try {
  const jobs = await jobService.fetchJobs();
  const swipedIds = await swipeService.fetchSwipedIds(userId, 'job');
} catch (error) {
  // error handling
}
```

### 4. **CompanySwipeScreen.tsx**
```typescript
// Zameni:
const { data } = await supabase.from('candidate_profiles').select('*');

// Sa:
import { candidateService, swipeService } from '../../services';
try {
  const candidates = await candidateService.fetchCandidates();
  const swipedIds = await swipeService.fetchSwipedIds(userId, 'candidate');
} catch (error) {
  // error handling
}
```

### 5. **ChatScreen.tsx**
```typescript
// Zameni:
const { data } = await supabase.from('messages').select('*');
await supabase.from('messages').insert({...});

// Sa:
import { messageService } from '../../services';
try {
  const messages = await messageService.fetchMessages(matchId);
  await messageService.sendMessage(matchId, userId, content);
  await messageService.markMessagesAsRead(matchId, userId);
} catch (error) {
  // error handling
}
```

### 6. **CreateJobScreen.tsx**
```typescript
// Zameni:
const { data, error } = await supabase.from('job_listings').insert({...});

// Sa:
import { jobService } from '../../services';
try {
  const job = await jobService.createJob(jobData);
} catch (error) {
  // error handling
}
```

### 7. **ProfileScreen.tsx**
```typescript
// Zameni:
const { error } = await supabase.from('profiles').update({...});

// Sa:
import { authService } from '../../services';
try {
  await authService.updateProfile(userId, updates);
} catch (error) {
  // error handling
}
```

### 8. **EditProfileScreen.tsx** (ako postoji)
```typescript
import { candidateService, companyService } from '../../services';

// Zavisno od user type-a
if (userType === 'candidate') {
  await candidateService.updateCandidateProfile(userId, updates);
} else {
  await companyService.updateCompanyProfile(userId, updates);
}
```

---

## 🛠 Template za Refaktorisanje

Evo template-a koji možete kopirat za bilo koji screen:

```typescript
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { jobService } from '../../services';  // ← Import service
import { handleError } from '../../lib/errors';  // ← Import error handler
import { COLORS } from '../../constants';  // ← Import constants

export default function MyScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const result = await jobService.fetchJobs();  // ← Koristi service
      setData(result);
    } catch (error) {
      const appError = handleError(error);  // ← Handle error properly
      Alert.alert('Greška', appError.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  return (
    <View style={{ backgroundColor: COLORS.dark }}>  {/* ← Use constants */}
      {/* ... */}
    </View>
  );
}
```

---

## ✨ Best Practices

1. **Uvek koristi service layer** - Nikada ne pozivaj Supabase direktno iz screen-a
2. **Uvek handle error-e** - Koristiti `handleError()` za sve API pozive
3. **Koristi constants** - Za boje, stringove, route-e
4. **Koristi helpers** - `formatDateTime()`, `formatDate()`, itd.
5. **Dodaj loading state** - `ActivityIndicator` dok se učitava
6. **Koristi useFocusEffect** - Za osvežavanje podataka kada se screen-u prikažе

---

## 🧪 Provera

Pre nego što commit-uješ, proveri:

- [ ] Svi Supabase pozivi su zamenjeni sa service layer-om
- [ ] Svi error-ovi se korektno rukovaju (ne samo console.log)
- [ ] Nema magic stringova (koristi constants)
- [ ] Loading state je prikazan
- [ ] TypeScript ima green checkmarks (bez errors)

---

## 📝 Primena Prioritet

**Priority 1** (Odmah):
- [x] LoginScreen.tsx
- [x] RegisterScreen.tsx
- [x] MatchesScreen.tsx (već je urađeno)

**Priority 2** (Sledeće):
- [ ] ChatScreen.tsx
- [ ] CreateJobScreen.tsx
- [ ] CandidateSwipeScreen.tsx

**Priority 3** (Kasnije):
- [ ] Ostali screens

---

## 🚀 Rezultat

Kada završite migraciju:
- Bolji performance
- Bolja maintainability
- Lakšnji testing
- Konzistentan error handling
- Bolje organizovani kod

Lako!
