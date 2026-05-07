# NoteBeat Kids — Deployment Readiness Checklist

Hedef: **Render Pro** (backend) + **Neon Scale** (PostgreSQL) + **Upstash Redis** (önbellek + WebSocket)

---

## 1. Ortam Değişkenleri

### Zorunlu (eksik olursa sunucu başlamaz)

| Değişken | Açıklama | Örnek |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL bağlantı URL'i | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |

### Kritik (eksik olursa güvenlik/performans etkisi)

| Değişken | Açıklama | Örnek |
|---|---|---|
| `SESSION_SECRET` | Oturum imzalama anahtarı (≥32 karakter rastgele) | `openssl rand -hex 32` çıktısı |
| `JWT_ACCESS_SECRET` | JWT access token anahtarı (≥32 karakter) | `openssl rand -hex 32` çıktısı |
| `JWT_REFRESH_SECRET` | JWT refresh token anahtarı (≥32 karakter, farklı) | `openssl rand -hex 32` çıktısı |
| `REDIS_URL` | Upstash Redis URL'i | `https://xxx.upstash.io` |
| `REDIS_TOKEN` | Upstash Redis token | Upstash konsolundan |
| `FRONTEND_URL` | İzin verilen frontend URL'leri (virgülle ayrılmış) | `https://notebeatkids.vercel.app` |

### Opsiyonel (varsayılan değerler var)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `5000` | HTTP port |
| `NODE_ENV` | `development` | `production` olarak ayarlayın |
| `ACCESS_TOKEN_TTL` | `15m` | JWT access token ömrü |
| `DB_POOL_MAX` | `10` | DB bağlantı havuzu boyutu |
| `DB_POOL_IDLE_TIMEOUT` | `30000` | Boşta kalma zaman aşımı (ms) |
| `DB_POOL_CONNECTION_TIMEOUT` | `8000` | Bağlantı zaman aşımı (ms) |
| `DB_STATEMENT_TIMEOUT` | `30000` | Sorgu zaman aşımı (ms) |

---

## 2. Render Pro Kurulumu

### Servis Ayarları

```
Build Command:   npm run build
Start Command:   node dist/index.cjs
Health Check:    /health
```

### Render Ortam Değişkenleri

Yukarıdaki tüm değişkenleri Render → Environment bölümüne ekleyin.

```
NODE_ENV=production
PORT=10000          # Render otomatik atar, genelde 10000
```

### Render Pro Özellikleri Kullanımı

- **Auto-Scaling**: Etkinleştirin — Redis adapter tüm instance'ları senkronize tutar
- **Health Check Path**: `/health` (her 30 sn kontrol eder)
- **Readiness Check Path**: `/ready` (DB + Redis durumu)
- **Zero-downtime Deploys**: `/ready` endpoint 200 dönünce yeni instance trafiğe alınır

### Ölçekleme Notu

Çoklu instance'da çalışan bileşenler:
- ✅ Socket.io — Redis adapter ile tüm instance'lar senkronize
- ✅ Leaderboard önbelleği — Redis'te paylaşılır
- ✅ JWT doğrulama — stateless, her instance bağımsız doğrular
- ✅ Rate limiting — auth için in-memory (kabul edilebilir, küçük leakage)
- ⚠️ Puan tamponu (scoreBuffer) — her instance bağımsız, 30 sn'de DB'ye yazar

---

## 3. Neon Scale Kurulumu

### Bağlantı Modu Seçimi

| Mod | URL Port | Kullanım |
|---|---|---|
| **Doğrudan** | 5432 | Render'ın tek bölge deployment'ı için |
| **PgBouncer** | 6543 | Çoklu instance / yüksek eşzamanlılık için (önerilen) |

**Önerilen**: PgBouncer URL kullanın (`?pgbouncer=true` veya port 6543).

```
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech:6543/neondb?sslmode=require&pgbouncer=true
```

PgBouncer kullanıyorsanız:
```
DB_POOL_MAX=50    # PgBouncer ile daha büyük havuz güvenli
```

Doğrudan bağlantı:
```
DB_POOL_MAX=10    # Neon compute başına limit
```

### Neon SSL Gereksinimi

`sslmode=require` DATABASE_URL'de olmalı. db.ts de `ssl: { rejectUnauthorized: false }` ayarlıdır.

### Performans Index'leri

Sunucu ilk başlatmada otomatik oluşturulur (`runMigrations()`):

```sql
CREATE INDEX IF NOT EXISTS idx_students_class_id       ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id       ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teachers_institution_id  ON teachers(institution_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_student_id ON student_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_monthly_stats_student_id ON monthly_stats(student_id);
CREATE INDEX IF NOT EXISTS idx_student_codes_code       ON student_codes(code);
CREATE INDEX IF NOT EXISTS idx_classes_class_code       ON classes(class_code);
```

---

## 4. Upstash Redis Kurulumu

### Bağlantı

Upstash konsolundan "ioredis" bağlantı bilgisini alın:

```
REDIS_URL=https://xxx.upstash.io
REDIS_TOKEN=AXxx...
```

Veya direkt `rediss://` formatında:
```
REDIS_URL=rediss://default:TOKEN@xxx.upstash.io:6379
```

### Upstash Planı

- **50.000 öğrenci** için: **Pay-as-you-go** veya **Pro 2GB** yeterlidir
- Önbellek TTL: 30 sn (leaderboard) + 30 gün (refresh token)
- Tahmini bellek: `(öğrenci sayısı × ortalama token boyutu) + önbellek`

### Redis Kullanım Alanları

| Anahtar Deseni | İçerik | TTL |
|---|---|---|
| `lb:{instId}:{type}::` | Leaderboard önbelleği | 30 sn |
| `rt:{role}:{id}:{jti}` | JWT refresh token | 30 gün |
| `rl:score:{studentId}` | Rate limit sayacı | 60 sn |
| `teacher:{id}` | Öğretmen önbelleği | 60 sn |
| `class:{code}` | Sınıf kodu önbelleği | 60 sn |

---

## 5. Vercel Frontend Kurulumu

```
Framework:    Vite
Build:        npm run build:client   # veya cd client && npm run build
Output:       dist/public
```

### Vercel Ortam Değişkenleri

```
VITE_API_URL=https://notebeatkids.onrender.com
VITE_WS_URL=wss://notebeatkids.onrender.com
```

### CORS Yapılandırması

Render'da `FRONTEND_URL` değişkenine Vercel URL'ini ekleyin:
```
FRONTEND_URL=https://notebeatkids.vercel.app,https://notebeatkids.com
```

---

## 6. Güvenlik Kontrol Listesi

- [ ] `SESSION_SECRET` ≥ 32 karakter rastgele — varsayılan değil
- [ ] `JWT_ACCESS_SECRET` ve `JWT_REFRESH_SECRET` farklı ve güçlü
- [ ] `FRONTEND_URL` production'da doldurulmuş
- [ ] Helmet güvenlik başlıkları etkin (app.ts'de varsayılan açık)
- [ ] Rate limiting etkin (auth endpoint'leri için)
- [ ] HTTPS zorunlu (Render ve Vercel otomatik sağlar)
- [ ] Neon SSL etkin (`sslmode=require`)
- [ ] Redis TLS etkin (`rediss://` protokolü)

---

## 7. Kapasite Tahminleri

### 50.000 Öğrenci Senaryosu

| Metrik | Tahmin |
|---|---|
| Eşzamanlı WebSocket | ~5.000 (okullar arası yayılır) |
| DB sorgular/sn | ~200–500 (önbellek ile) |
| Redis operasyon/sn | ~500–1.000 |
| Bellek/instance | ~256–512 MB |
| Önerilen Render plan | **Pro** (2 CPU, 2GB RAM) |
| Önerilen instance sayısı | 2–4 (auto-scale) |

### Darboğaz Noktaları

1. **Puan tamponu (scoreBuffer)**: Her 30 sn'de DB'ye toplu yazar — N+1 sorgu önlenir ✅
2. **Leaderboard sorgusu**: 30 sn Redis önbelleği — DB yükü düşürülür ✅
3. **WebSocket**: Redis adapter ile tüm instance'lara yayılır ✅
4. **DB bağlantıları**: PgBouncer kullanın, `DB_POOL_MAX=50` ✅

---

## 8. Deployment Adımları

1. Neon Scale veritabanı oluştur → `DATABASE_URL` al
2. Upstash Redis oluştur → `REDIS_URL` + `REDIS_TOKEN` al
3. Render'da Web Service oluştur → GitHub repo bağla
4. Tüm ortam değişkenlerini Render'a ekle
5. `NODE_ENV=production` ayarla
6. İlk deploy'u başlat → migration'lar otomatik çalışır
7. `/health` ve `/ready` endpoint'lerini kontrol et
8. Vercel'de frontend deploy et
9. `FRONTEND_URL` → Render ortam değişkenine Vercel URL'ini ekle
10. Yük testi yap (önce küçük ölçekte)

---

## 9. İzleme ve Alarm

- **Render Metrics**: CPU, RAM, response time dashboard
- **Neon**: Query insights, connection counts
- **Upstash**: Request/saniye, bellek kullanımı
- **Health endpoint**: `/ready` — external uptime monitor (UptimeRobot vb.) ile izle
- **Log pattern**: `❌` ve `⚠️` prefix'li loglar kritik

---

## 10. Olası Sorunlar ve Çözümler

| Sorun | Neden | Çözüm |
|---|---|---|
| `CORS blocked` | FRONTEND_URL eksik veya yanlış | Render'da FRONTEND_URL güncelle |
| `Cannot connect to DB` | Neon cold start (~3 sn) | `connectionTimeoutMillis=8000` ayarlı ✅ |
| `Redis connection failed` | Upstash IP/token sorunu | REDIS_URL formatını kontrol et; uygulama çalışmaya devam eder |
| `JWT invalid` | Sır anahtarları farklı instance'da farklı | SESSION_SECRET tüm instance'da aynı olmalı |
| `WebSocket disconnect` | Redis adapter başlatılamadı | Redis bağlantısını kontrol et |
| `429 Too Many Requests` | Rate limit tetiklendi | Normal davranış — öğrencilere hata mesajı göster |
| Yüksek bellek | Çok socket bağlantısı | `IDLE_TIMEOUT_MS=30dk` — boşta kalanlar otomatik kesilir ✅ |
