# 📚 QUICK REFERENCE - Brzo Pronalaženje

## 🔍 Pretraga Po Kategoriji

### Boje (COLORS)
📍 Lokacija: `src/constants/colors.ts`

```typescript
import { COLORS } from '../../constants';

COLORS.primary      // #6C63FF (purple)
COLORS.dark         // #0a0a0a
COLORS.white        // #fff
COLORS.error        // #FF6B6B
COLORS.success      // #51CF66
// itd...
```

### Rute (ROUTES)
📍 Lokacija: `src/constants/routes.ts`

```typescript
import { ROUTES } from '../../constants';

ROUTES.LOGIN           // 'Login'
ROUTES.REGISTER        // 'Register'
ROUTES.SWIPE           // 'Swipe'
ROUTES.MATCHES         // 'Matches'
ROUTES.CHAT            // 'Chat'
// itd...
```

### Veličine (SIZES)
📍 Lokacija: `src/constants/sizes.ts`

```typescript
import { SIZES } from '../../constants';

SIZES.xs              // 4
SIZES.md              // 12
SIZES.lg              // 16
SIZES.font_lg         // 18
SIZES.radius_md       // 12
// itd...
```

---

## 🔧 Service Layer

### Auth Service
📍 Lokacija: `src/services/authService.ts`

```typescript
import { authService } from '../../services';

authService.signIn(email, password)
authService.signUp(email, password, fullName, userType)
authService.resetPassword(email)
authService.signOut()
authService.updateProfile(userId, updates)
authService.fetchProfile(userId)
```

### Job Service
📍 Lokacija: `src/services/jobService.ts`

```typescript
import { jobService } from '../../services';

jobService.fetchJobs(filters)
jobService.fetchJobById(jobId)
jobService.fetchCompanyJobs(companyId)
jobService.createJob(jobData)
jobService.updateJob(jobId, updates)
jobService.deleteJob(jobId)
```

### Match Service
📍 Lokacija: `src/services/matchService.ts`

```typescript
import { matchService } from '../../services';

matchService.fetchMatches(userId, userType)  // ← Optimizovano sa joins!
matchService.fetchMatchById(matchId)
matchService.createMatch(candidateId, companyId, jobId)
matchService.deleteMatch(matchId)
```

### Message Service
📍 Lokacija: `src/services/messageService.ts`

```typescript
import { messageService } from '../../services';

messageService.fetchMessages(matchId)
messageService.sendMessage(matchId, senderId, content)
messageService.markMessagesAsRead(matchId, userId)
messageService.fetchUnreadCount(userId, userType)
```

### Swipe Service
📍 Lokacija: `src/services/swipeService.ts`

```typescript
import { swipeService } from '../../services';

swipeService.recordSwipe(swipe)  // { swiper_id, target_id, target_type, direction }
swipeService.fetchSwipedIds(userId, targetType)
swipeService.fetchSwipeStats(userId, userType)
```

### Candidate Service
📍 Lokacija: `src/services/candidateService.ts`

```typescript
import { candidateService } from '../../services';

candidateService.fetchCandidateProfile(candidateId)
candidateService.updateCandidateProfile(candidateId, updates)
candidateService.fetchCandidates(filters)
candidateService.searchCandidates(query)
```

### Company Service
📍 Lokacija: `src/services/companyService.ts`

```typescript
import { companyService } from '../../services';

companyService.fetchCompanyProfile(companyId)
companyService.updateCompanyProfile(companyId, updates)
companyService.fetchCompanies(limit)
companyService.searchCompanies(query)
```

---

## ⚠️ Error Handling

📍 Lokacija: `src/lib/errors.ts`

### Klase

```typescript
import {
  AppError,
  AuthError,
  NetworkError,
  ValidationError,
  NotFoundError,
  handleError,
  getErrorMessage
} from '../../lib/errors';

// Korišćenje:
try {
  await jobService.fetchJobs();
} catch (error) {
  const appError = handleError(error);  // Konvertuje u AppError
  console.log(appError.message);        // User-friendly poruka
  console.log(appError.statusCode);     // HTTP status
  console.log(appError.code);           // Error code
}
```

### Statusovi

- `AuthError` → 401 (Sesija istekla)
- `NetworkError` → 0 (Nema konekcije)
- `ValidationError` → 422 (Loši podaci)
- `NotFoundError` → 404 (Nije pronađeno)
- `AppError` → 400 (Opšta greška)

---

## 🛠 Utility Funkcije

📍 Lokacija: `src/utils/helpers.ts`

### Formatiranje

```typescript
import {
  formatDate,
  formatTime,
  formatDateTime,
  truncateText,
  capitalizeFirst
} from '../../utils/helpers';

formatDate('2026-06-09')            // "9. juna 2026"
formatTime('2026-06-09T14:30:00')   // "14:30"
formatDateTime('2026-06-09T...')    // "5m", "2h", "3d", "yesterday"
truncateText("Dugi tekst...", 20)   // "Dugi tekst..."
capitalizeFirst("hello")            // "Hello"
formatLocation("novi sad")          // "Novi sad"
```

### Validacija

```typescript
validateEmail("test@example.com")    // true
validatePassword("secret123")        // { valid: true, errors: [] }
isValidUrl("https://example.com")    // true
```

### Helpers

```typescript
calculateDistance(lat1, lon1, lat2, lon2)  // Distanca u km
retry(() => fetchData(), 3, 1000)          // Retry 3x sa 1s delay
debounce(handleSearch, 300)                // Debounce 300ms
throttle(handleScroll, 1000)               // Throttle 1s
```

---

## 🐛 Debugging

### Logovanje
```typescript
// Koristi console normalno, sve će biti viđeno
console.log('Debug:', data);
console.error('Error:', error);
```

### Error Boundary
```typescript
// Prikazuje error screen ako app crash-uje
// Nalazi se u App.tsx
// Prikazuje "⚠️ Došlo je do greške" sa "Pokušaj ponovo" dugmetom
```

### Services su Safe
```typescript
// Svi services već imaju try-catch sa handleError()
// Samo trebate koristiti try-catch u screen-u
```

---

## 📦 Import Cheat Sheet

```typescript
// Boje
import { COLORS } from '../../constants';

// Rute
import { ROUTES } from '../../constants';

// Sve konstante
import { COLORS, ROUTES, SIZES, ERROR_MESSAGES } from '../../constants';

// Services
import { authService, jobService, matchService, messageService } from '../../services';

// Errors
import { handleError, getErrorMessage } from '../../lib/errors';

// Helpers
import { formatDateTime, calculateDistance, retry } from '../../utils/helpers';

// Types
import { Profile, JobListing, Match } from '../../types';

// Hooks
import { useAuth } from '../../hooks/useAuth';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';

// Navigation
import { useFocusEffect } from '@react-navigation/native';
```

---

## 🚀 Česti Scenariji

### Scenario 1: Učitaj podatke iz service-a

```typescript
import { useCallback, useState } from 'react';
import { jobService } from '../../services';
import { handleError } from '../../lib/errors';
import { Alert } from 'react-native';

const [jobs, setJobs] = useState<any[]>([]);
const [loading, setLoading] = useState(false);

const loadJobs = useCallback(async () => {
  try {
    setLoading(true);
    const data = await jobService.fetchJobs();
    setJobs(data);
  } catch (error) {
    const appError = handleError(error);
    Alert.alert('Greška', appError.message);
  } finally {
    setLoading(false);
  }
}, []);
```

### Scenario 2: Optimizovano učitavanje sa refresh-om

```typescript
import { useFocusEffect } from '@react-navigation/native';
import { RefreshControl } from 'react-native';

useFocusEffect(
  useCallback(() => {
    loadMatches();
  }, [loadMatches])
);

// U FlatList-u:
<FlatList
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={loadMatches}
      tintColor={COLORS.primary}
    />
  }
/>
```

### Scenario 3: Real-time subscription

```typescript
useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel(`table-${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      loadMessages();  // Osvežava kada se podaci promene
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [user?.id]);
```

---

## 🎯 Checklist za Novi Screen

Kada kreirate novi screen:

- [ ] Import svih potrebnih service-a
- [ ] Dodaj error handling sa `handleError()`
- [ ] Koristi `COLORS` iz constants-a
- [ ] Koristi `SIZES` iz constants-a
- [ ] Dodaj loading state
- [ ] Koristi `useFocusEffect` za podatke
- [ ] Koristi real-time subscription gde je potrebno
- [ ] Formate datume sa `formatDateTime()`
- [ ] Prosledi u PropTypes ili TypeScript types

---

## 🔐 Sigurnost

- ✅ Nikada ne hardkoduj Supabase ključ
- ✅ Uvek koristi `.env` za konfiguraciju
- ✅ Uvek handle error-e (ne prikazuj technički error korisnik-u)
- ✅ Validuj input pre nego što pošalješ na server
- ✅ Koristi `handleError()` za sve API pozive

---

## 📞 Brze Veze

- 📖 Detalji: [IMPROVEMENTS.md](IMPROVEMENTS.md)
- 🔄 Migracija: [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
- ✅ Checklist: [COMPLETION_CHECKLIST.md](COMPLETION_CHECKLIST.md)
- 📚 Ovaj fajl: [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

---

## 🎉 Gotovo!

Sve što trebate je sve ovde. Srediti se ako vam nedostaje nešto!
