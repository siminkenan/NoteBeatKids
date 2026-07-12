---
name: Production Shield v1
description: Sistem sağlık izleme altyapısı — hangi dosyalar değişti, hangi kararlar alındı.
---

## Ne yapıldı

### Yeni dosyalar
- `server/apiMetrics.ts` — requestMetricsMiddleware + getApiMetrics(); in-memory, DB'ye yazmaz.
- `server/errorReporter.ts` — Köprü modülü; app.ts → storage.ts döngüsel bağımlılığını önler. setErrorReporter(fn) ile index.ts'te bağlanır.
- `server/healthService.ts` — getHealthReport() agregasyon fonksiyonu; leaderboardStats + monthlyResetStats + integrityStats in-memory nesneleri burada tutulur.
- `server/integrityScanner.ts` — 5 dk gecikmeli, 4 saatte bir DB okuma. Sadece okur, yazmaz. Sorun bulursa audit_logs'a INTEGRITY_WARNING yazar.

### Değiştirilen dosyalar
- `shared/schema.ts` — systemErrors pgTable eklendi (system_errors migration, runMigrations'da CREATE TABLE IF NOT EXISTS).
- `server/scoreBuffer.ts` — flushStats export (lastFlushAt/DurationMs/Success/Error) + dirtyInstitutionCount() eklendi. flushScoreBuffer() artık timing/status kaydediyor.
- `server/socket.ts` — getSocketStats() eklendi. broadcastLeaderboard() artık leaderboardStats'ı güncelliyor.
- `server/storage.ts` — IStorage.createSystemError() + DatabaseStorage implementasyonu eklendi.
- `server/routes.ts` — GET /api/admin/health + GET /api/admin/system-errors (admin-only). requestMetricsMiddleware son route olarak eklendi.
- `server/app.ts` — Global 500 handler'da reportSystemError() çağrısı eklendi.
- `server/index.ts` — SYSTEM_START/STOP, FLUSH_SUCCESS/FAILED, MONTHLY_RESET_SUCCESS/FAILED audit log'ları eklendi. startIntegrityScanner() + setErrorReporter() bağlantısı yapıldı. system_errors + audit_logs index'leri runMigrations'a eklendi.
- `client/src/pages/admin-dashboard.tsx` — "Sistem Sağlığı" sekmesi eklendi. HealthDashboard bileşeni (React Query refetchInterval: 30s, 8 kart).

## Önemli kararlar

**Why errorReporter.ts bridge:** app.ts, storage.ts'i import etmiyor — döngüsel import önlemek için. index.ts'te storage hazır olduktan sonra setErrorReporter() ile bağlanır.

**Why requestMetricsMiddleware routes.ts'te:** registerRoutes() sonunda eklendi, ayrı bir Express middleware olarak değil. Mevcut app.ts mimarisini değiştirmemek için.

**Why integrityScanner sadece okur:** Orphan kayıt düzeltme kararı human onayı gerektiriyor. Scanner sadece tespit eder + audit log yazar.

**How to apply:** Health endpoint admin login gerektirir (getAdminId check). Yeni system_errors tablosu migration'da otomatik oluşuyor.
