# UI Audit — Project-Wide Audit (2026-04-23)

**Scope**: Complete codebase tarandı; config, DB, API, scanner, audit engine, queue, AI, crawler, UI.
**Target**: Enterprise-grade AIO audit platform (UI/UX/SEO/Security/Accessibility).
**Method**: Her dosya birebir okundu; statik analiz. Runtime test edilmedi (sonraki adım).
**Current commit**: `8f17da9`.

Bu döküman "olan" ile "olması gereken" arasındaki farkı çıkarır. Her madde **kanıtlanmış** (dosya:satır referansıyla) ya da **yüksek olasılıklı** olarak işaretlidir.

Severity scale:
- **BLOCKER** — tool bu haliyle amacına hizmet etmiyor, satmaya uygun değil.
- **P0** — güvenlik/veri kaybı/doğruluk; ilk sprintte düzelt.
- **P1** — enterprise sözü verilen konularda fonksiyonel eksik/kalite sorunu; next release.
- **P2** — polish, code quality, operasyonel iyileştirme.

---

## TL;DR — Top 10 Acil Bulgu

| # | Başlık | Severity | Nerede |
|---|--------|----------|--------|
| 1 | AI provider'ları PNG diye WebP gönderiyor → her AI çağrısı yanlış/patlıyor | **BLOCKER** | `ai/claude.ts:31`, `ai/openai.ts:31` |
| 2 | Uygulama tamamen **public** — auth yok, rate-limit yok, SSRF koruması yok | **BLOCKER** | API routes, `next.config.ts` |
| 3 | `--no-sandbox` Chromium ile rastgele URL tarıyoruz — host escape riski | **P0** | `scanner/browser.ts:31-40` |
| 4 | BullMQ worker'ı Next.js process'i içinde doğuyor; gerçek worker yok | **P0** | `api/scans/route.ts:10-17`, `queue/scan-worker.ts` |
| 5 | Sabit Chromium debug portu 9222 + `concurrency: 1` → **aynı anda tek scan** | **P0** | `scanner/browser.ts:28`, `queue/scan-worker.ts:176` |
| 6 | Global mutable `lastLighthouseScores` → concurrent scan'lerde skorlar karışır | **P0** | `audit/engine.ts:36` |
| 7 | SSE pub/sub in-memory → worker ayrı process'e çıkınca ilerleme UI'a akmaz | **P0** | `queue/scan-events.ts` |
| 8 | `.env`'de gerçek OpenAI API key var (git'te değil, ama dosyada açık) | **P0** | `.env:9` |
| 9 | Tüm "crawler exclude pattern" kullanıcıya glob'muş gibi gösterilip `includes()` ile çalışıyor (yalan UI) | **P1** | `crawl-form.tsx:279`, `crawler/crawler.ts:101-104` |
| 10 | Hiç test yok (unit, integration, e2e) | **P1** | Repo genelinde |

Detaylar aşağıda.

---

## 1. GÜVENLİK (Security Audit)

### 1.1 [BLOCKER] Tam public endpoint'ler — authentication yok
Middleware yok (`src/middleware.ts` mevcut değil), auth/session kontrolü hiçbir route'da yok. Herkes, ağ erişimi olan herkes:
- **Tarama tetikleyebilir** (AI key'inizi yakar, sunucu CPU'sunu yer)
- **Tüm scan/crawl'ları listeleyebilir** — `/api/scans`, `/api/crawls`, `/api/batches` GET hepsi açık
- **DELETE ile her şeyi silebilir** — `DELETE /api/scans/[id]`, `DELETE /api/batches/[id]`, `DELETE /api/crawls/[id]`
- **AI remediation'ı çağırabilir** — `/api/remediate` (provider API key'i yakılır)
- **PDF/CSV export** alabilir
- **Crawler'ı 3. tarafa karşı tetikleyebilir** (hedef sitede reputational/legal sorun)

**Kanıt**: `src/app/api/**/route.ts` — hiçbirinde auth/session/token kontrolü yok.

**Enterprise için gereken**: API key auth + user/workspace model + RBAC. En azından başlangıçta single-user self-hosted varsayılsa bile password/API token şart.

### 1.2 [BLOCKER] SSRF (Server-Side Request Forgery) — tarayıcı herhangi bir URL'ye gidebilir
`POST /api/scans` sadece `z.string().url()` ile doğruluyor. Bu şu URL'leri geçirir:
- `http://localhost:6379` (Redis) — tarayıcı bağlanamasa da crawl içindeki `fetch` bağlanır
- `http://127.0.0.1:5432` (Postgres)
- `http://169.254.169.254/latest/meta-data/` (AWS metadata endpoint — credential çalınabilir)
- `http://internal.corp.local/`
- `file:///etc/passwd` (Chromium bloklar ama test etmeli)
- `http://[::1]:port/`

**Kanıt**: `src/app/api/scans/route.ts:20`, `src/app/api/crawls/route.ts:19`, `src/lib/crawler/crawler.ts:36` (robots.txt `fetch`), `src/lib/crawler/sitemap.ts:8` (sitemap `fetch`).

**Gerekli**: URL için
- Protokol allowlist: sadece `http://`/`https://`
- IP allowlist / blocklist (private ranges, link-local, loopback blokla)
- DNS resolution sonrası ikinci kontrol (DNS rebinding saldırısı)
- Cloud metadata endpoint bloklu (`169.254.169.254`, `fd00:ec2::254`)

### 1.3 [P0] `--no-sandbox` ile rastgele URL tarama
`scanner/browser.ts:31-40` Chromium'u `--no-sandbox --disable-setuid-sandbox` ile başlatıyor. Kullanıcı input URL açıldığında Chrome exploit → container/host escape'e dönüşebilir.

**Çözüm**: Docker container'da non-root olarak Chromium sandbox'ı etkin tut (`--cap-add=SYS_ADMIN` + user namespace), veya en azından isolated VM/gVisor kullan.

### 1.4 [P0] API key expozisyonu
`.env:9` — gerçek OpenAI key kontrol edildi. `.gitignore` kapsamında olsa bile local dev dosyasında clear-text. Docker image'a kopyalanırsa image layer'larında kalır.

`Dockerfile:47` `env_file: - .env` kullanıyor — runtime'da OK ama build context'e `.env` gitmesin.

**Çözüm**: 
- `.env` dosyasındaki mevcut key'i **hemen revoke et** (OpenAI dashboard'dan)
- Secrets'i docker compose `secrets:` veya Vault/SSM/Secrets Manager'dan al
- Dockerfile'da `.dockerignore`'a `.env` ekle

### 1.5 [P0] Rate limiting yok — cost DoS vektörü
`/api/scans`, `/api/crawls`, `/api/remediate` hiçbir rate limit barındırmıyor. Saldırgan:
- 1000 scan tetikler → Chromium 1000 kere lansman → disk dolar
- 1000 remediate çağrısı → OpenAI/Anthropic fatura patlar
- Her scan 3 AI çağrısı (3 viewport) + max 8192 token output

**Gerekli**: Redis-backed rate limiter (ör. `@upstash/ratelimit`) veya BullMQ level concurrency + IP/token başı quota.

### 1.6 [P0] CSRF koruması yok
DELETE endpoint'leri CSRF token istemiyor. Eğer ileride cookie auth eklenirse otomatik CSRF açığı doğar. Şimdi fix'lemeden auth eklenmesin.

### 1.7 [P0] `/api/screenshots/[...path]` directory traversal — "büyük ihtimal güvenli ama kırılgan"
`api/screenshots/[...path]/route.ts:13-19` `join()` sonrası `startsWith` ile kontrol yapıyor. `path.join` `..` normalize eder, yani `/public/screenshots/../../etc/passwd` → `/etc/passwd` olup `.startsWith("/public/screenshots")` false döner → bloklanır. ✓

Ancak:
- Symlink takip kontrolü yok. `public/screenshots/` altında symlink yaratılırsa `/etc/passwd` okutulabilir.
- Path normalization testi yok.

**Çözüm**: `fs.realpath(filePath)` + `startsWith(realpath(resolved))` ile sıkılaştır.

### 1.8 [P1] Output sanitization — AI remediation HTML'i
`/api/remediate` AI'dan dönen HTML'i DB'ye kaydediyor, UI'da `<pre>` içinde render ediliyor (`issue-card.tsx:167`, `category-detail.tsx:148`) — text olarak, HTML parse edilmeden. Şu an XSS yok. Ancak:
- AI'dan `<script>` dönerse ve biri `dangerouslySetInnerHTML` ile basmaya kalkarsa risk.
- `jsPDF` PDF'e markdown enjeksiyonu dikkat gerektirir (şu an escape edilmiyor).

### 1.9 [P1] Upload / file input yok
Avantaj: dosya yükleme yüzeyi yok. Bu güvenlik için iyi, ancak enterprise için çoğu zaman gerekecek (logo, custom header, CSV URL listesi upload). Eklerken secure upload pattern'i uygula.

### 1.10 [P2] Security runner kendini kontrol etmiyor
Uygulamamız kendi güvenlik başlıklarını set etmiyor: CSP, HSTS, X-Content-Type-Options, Permissions-Policy yok. (Ironic — security audit tool'u kendi audit'inden F alır.) `next.config.ts`'ye `headers()` async fonksiyon ekle.

### 1.11 [P2] Postgres/Redis default credentials
`docker-compose.yml:5-7` `uiaudit:uiaudit`, Redis password'suz. Prod deploy'da değiştirilmek zorunda — `.env` template'e zorla.

---

## 2. KORRELİK & MİMARİ (Correctness & Architecture)

### 2.1 [BLOCKER] AI vision — WebP screenshot'ı PNG diye gönderiliyor
`scanner/capture.ts` screenshot'ları **`.webp`** olarak yazıyor (`capture.ts:339,373,493,497`). Ama:
- `ai/claude.ts:31` → `media_type: "image/png"` hard-coded
- `ai/openai.ts:31` → `data:image/png;base64,...` hard-coded

Claude SDK `media_type` tutarsızlığında 400 döner; OpenAI biraz toleranslı ama doğru olmayabilir. **Her AI analizi sessiz hata veriyor ya da yanlış decode ediyor**.

**Fix**: `image/webp` (Claude ve GPT-4o destekler) veya screenshot formatını PNG'e çevir.

### 2.2 [P0] `lastLighthouseScores` modül seviyesinde mutable global
`audit/engine.ts:36` `let lastLighthouseScores: Record<string, number> | null = null;` — iki scan aynı anda çalışsa (şu an `concurrency: 1` ama değiştiği gün patlar), `scoring.ts:62` getLastLighthouseScores()'u çağırdığında DİĞER scan'in skorlarını okur.

**Fix**: `lighthouseScores`'u worker context'inde arg olarak taşı; global'e asla yazma.

### 2.3 [P0] Worker inside Next.js process — scaling imkansız
`api/scans/route.ts:10-17`:
```ts
let workerStarted = false;
async function ensureWorker() {
  if (!workerStarted) {
    await startScanWorker();
    workerStarted = true;
  }
}
```

Problem:
- Worker Next.js server process'i içinde doğuyor. Next.js restart → tüm in-flight scan'ler drop.
- Multi-process / multi-instance Next.js deployment'ında her process ayrı worker başlatır → job'lar rasgele yerde işlenir, log'lar dağılır.
- Serverless deployment'ta (Vercel) tamamen çalışmaz.

**Fix**: Worker ayrı `worker` service olarak çalışsın (`docker-compose.yml`'de yeni service). `npm run worker:scan` / `npm run worker:crawl` script'leri.

### 2.4 [P0] Sabit Chromium debug portu 9222 ⇒ global single-scan bottleneck
`scanner/browser.ts:28` `const DEBUGGING_PORT = 9222;` — bu port Lighthouse'un ihtiyaç duyduğu remote debugging protocol portu. İki browser aynı anda aynı portu dinleyemez. **Concurrency 1'e kilitlenmiş**, `queue/scan-worker.ts:176`'de `concurrency: 1`.

**Fix**: Her scan için rastgele port seç (ör. 9222 + crypto.randomInt(0, 10000)), browser.launch args'a inject et. Sonra Lighthouse'a aynı portu geç.

### 2.5 [P0] Shared browser session per engine — state contamination
`scanner/browser.ts:10` `activeSessions = new Map<string, BrowserSession>()`. Concurrency>1 olduğunda aynı Chromium browser'ını iki scan paylaşır — cookies, storage, trace'ler sızar. Farklı URL'ler birbirinin state'ini görür.

**Fix**: Her scan için yeni browser process. Browser pool istenirse iyi ama scan başına izole context + gerekirse izole browser.

### 2.6 [P0] Scan events pub/sub in-process memory
`queue/scan-events.ts` — `listeners = new Map<string, Set<EventListener>>`. Worker ayrı process'e taşındığında (P0 #2.3'te zorunlu), SSE endpoint'i `/api/scans/[id]/events` worker'ın yayınladığı event'leri ASLA göremez.

**Fix**: Redis pub/sub kullan — `subscribeScanEvents` Redis subscribe, `publishScanEvent` Redis publish. BullMQ zaten Redis'te.

### 2.7 [P0] Retry'da duplicate viewport results
`queue/scan-queue.ts:24` `attempts: 2` set edilmiş ama `processScanJob` baştan çalışınca önceki `viewport_results` / `audit_issues` silinmiyor. Retry → viewport kayıtları iki kere eklenir.

**Fix**: Worker başında `DELETE FROM viewport_results WHERE scan_id = ?` (ve ilgili tablolar).

### 2.8 [P0] `closeBrowser` iki kez çağrılıyor
`queue/scan-worker.ts:104` (success path, Lighthouse sonrası) ve :155 `finally`'de ikinci defa. `closeBrowser` try/catch ile sarılı olduğu için patlamaz, ama `activeSessions.delete` iki kere çalışınca sonraki scan session map'i temiz bulur — OK. Kod smells var, temizle.

### 2.9 [P0] Shared session + `activeSessions` garbage
`closeBrowser(session)` çağrıldığında `activeSessions.delete(session.engine)` yapılıyor. OK. Ama:
- Worker crashed'e düşerse browser process kalır, `activeSessions` boşalır.
- Her zombie browser ~300MB RAM.

**Fix**: `process.on('beforeExit', cleanup)`, worker stalled detection, zombie reap.

### 2.10 [P0] Runner'lar çalışmıyor / dead code
- `audit/rules/forms.ts:31` `runFormChecks` — hiç çağrılmıyor (`grep` confirmed). Scan'de form auditing yok.
- `audit/rules/accessibility.ts`, `performance.ts`, `seo.ts` — 3 satırlık stub (replaced by runners). Dead file; sil ya da gerçek logic ekle.
- `queue/crawl-queue.ts:2` `import type { CrawlConfig }` — kullanılmıyor.

### 2.11 [P0] `viewportResultId` semantiği karışmış
`audit/engine.ts:92,105,167,198,227` — HTMLHint, security, CSS analysis, Lighthouse issue'larını `results[0].id`'a (ilk viewport'un ID'si) bağlıyor. Bu checkler **page-level**, viewport-level değil. UI'da `By Viewport` tab'ında yanlış viewport'a bağlı görünürler.

**Fix**: Page-level issue'lar için `viewportResultId: null` gönder, UI'da "All viewports" rozetiyle göster. Ya da yeni tablo: `page_issues` (scan_id only).

### 2.12 [P1] Cross-origin CSS capture sessiz başarısız
`capture.ts:292-304` `document.styleSheets` iterasyonu cross-origin CSS'de exception fırlatır ve catch'lenir. Çoğu gerçek site CDN CSS kullanır → **`pageCss` boş çıkar, CSS audit'i hiç çalışmaz**. Kullanıcı farkında değil.

**Fix**: 
- Network sniffing ile CSS response'larını topla (CDP `Network.responseReceived`),
- ya da script tag üzerinden CSS URL'lerini fetch edip topla (aynı context'te, Playwright `request` context'iyle).

### 2.13 [P1] Screenshot boyutları ve DOM snapshot koordinatları farklı referans frame'de
Screenshot WebP olarak kaydediliyor, potansiyel olarak scaled-down (`WEBP_MAX_DIM = 16383` limit). `domSnapshot.elements[i].rect` ise browser coordinate space'te (CSS pixel). `annotation-overlay.tsx` ikisini aynı sayıyormuş gibi çiziyor. DeviceScaleFactor 2x/3x'te kutu mevkii yanlış çıkar.

**Kanıt**: `capture.ts:812-937` snapshot CSS pixel'de; screenshot `deviceScaleFactor` ile çarpılmış pixel'de (`takeScreenshot` tile'larda). `viewport-tabs.tsx:147-148` `screenshotWidth` parametresini SVG viewBox'a geçer — viewBox CSS pixel mi device pixel mi belirsiz.

**Fix**: Annotation overlay viewBox'ı `snapshot.viewportWidth`/`documentWidth` kullan; screenshot'ı `width:100%` ile scale et. Koordinatları tek bir referans frame'e normalize et.

### 2.14 [P1] `detectContentHeight` iş yoğun
`capture.ts:616-699` — `body.querySelectorAll("*")` iki kere + z-index parse + rect hesabı. Büyük sitelerde (40k+ element) 2-5 saniye ek gecikme.

**Fix**: Sadece `html.scrollHeight` fallback'i kullan; özel case'ler için opt-in flag.

### 2.15 [P1] Screenshot tile stitching kırılgan
Fixed/sticky element detection + hide/show between tiles — header/footer/modal kombinasyonlarında kaçınılmaz edge case'ler var. Son commit'te (`8f17da9`) düzeltildi ama hala deterministic değil: 
- Scroll listener'a bağımlı layout'lar (parallax, scroll-triggered animations) garip davranır.
- `window.scrollTo({ behavior: 'instant' })` bazı tarayıcılarda smooth sayar.
- `position: sticky` element'i `display: none` ile gizleyince neighbor element collapse olabilir.

**Öneri**: Chrome DevTools Protocol'ün native full-page screenshot'ını kullan (`Page.captureScreenshot({captureBeyondViewport: true})`). Tile yerine tek shot.

### 2.16 [P1] CrawlDelay respected mi?
`crawler/crawler.ts:168-170` — `robotsRules.crawlDelay ?? config.crawlRate` kullanıyor. OK, ama bu `undefined` yerine `0` olursa delay 0'a düşer. `parseInt("", 10)` NaN döndürür, `?? 0`'a düşmez → rate limiter atlanır. Edge case var.

### 2.17 [P1] AI / LLM çağrıları için timeout/retry yok
`claude.ts`, `openai.ts` — `client.messages.create` / `chat.completions.create` çağrısında `signal`/`timeout` yok. Sağlayıcı hang'larsa scan saatlerce asılı kalır.

### 2.18 [P1] jsPDF autotable loaded dynamically ama hata handle edilmiyor
`api/scans/[id]/pdf/route.ts:24-25` — `import("jspdf")` başarısızsa 500 fırlar. OK. Ancak PDF output büyük raporlar için ya pagesize aşar ya OOM eder.

### 2.19 [P2] Zod schema'ları client/server'da paylaşılmıyor
`scan-form.tsx:36-47` client-side schema, `api/scans/route.ts:19-28` server-side schema — manuel senkron. Bir yer güncellense diğeri eskir.

**Fix**: `src/lib/validation/scan.ts`'e taşı, iki taraf import etsin.

### 2.20 [P2] `crawler` içinde pattern matching glob iddiası
`crawl-form.tsx:279` kullanıcıya `*.pdf`, `/blog/*` glob pattern örneği veriyor. `crawler/crawler.ts:101-103` ise `normalizedUrl.includes(pattern)` yapıyor — literal substring. `*` karakteri include sonucu değişmez.

**Kullanıcı yanıltılıyor.** Ya gerçek glob (`minimatch`) ekle, ya UI metnini düzelt (`substring içerir`).

### 2.21 [P2] `hreflang` field boş kalıyor
`extractor.ts:91-96` DOM'dan okunuyor ama `sitemap.ts` hreflang desteklemez. Küçük nüans — SEO için güçsüz.

### 2.22 [P2] `securityHeaders` crawl'da toplanıyor ama hiçbir UI göstermiyor
`crawl_pages.security_headers` DB kolonu var, `crawler.ts` doldurmuyor bile (`responseHeaders`'a atanması eksik) — `crawler.ts:137` `securityHeaders: pageData.securityHeaders` → extractor bunu boş döndürüyor. **Data toplandığı sanılıyor, aslında boş.**

### 2.23 [P2] `includePatterns` API'de accept ediliyor ama UI'da yok
`api/crawls/route.ts:25` schema'da var, `crawl-form.tsx`'de input alanı yok. Feature yarım.

### 2.24 [P2] DOM snapshot 500 element ile hard cap
`capture.ts:867` `.slice(0, 500)` — büyük sitelerde (e-ticaret, tablo içeren dashboard'lar) 500 insufficient. Accessibility/typography kontrolleri eksik kalır.

---

## 3. VERİTABANI (Data Model)

### 3.1 [P0] Foreign key index'leri yok
`drizzle/0000_polite_eternals.sql` tablolar oluşturulurken FK constraint'ler eklendi ama **FK index'leri eklenmedi**. Bu Postgres'te ciddi performans sorunu yaratır, özellikle cascade delete'te.

Eksik index'ler:
- `scans.batch_id`
- `viewport_results.scan_id`
- `audit_issues.scan_id`, `audit_issues.viewport_result_id`
- `category_scores.scan_id`
- `crawl_pages.crawl_id`

Tek bir scan silerken cascade için bu tabloların full-scan'i gerekebilir.

**Fix**: Yeni migration: `CREATE INDEX CONCURRENTLY ... ON <table> (<fk_col>)`.

### 3.2 [P0] `scans.created_at DESC` sıralama için index yok
Dashboard, history page'leri `ORDER BY created_at DESC` kullanıyor. 10k+ scan'de tablo scan + external sort.

**Fix**: `CREATE INDEX scans_created_at_idx ON scans (created_at DESC);`

### 3.3 [P1] Ownership / multi-tenancy yok
Hiçbir tabloda `user_id` / `workspace_id` yok. Enterprise için olmazsa olmaz. Şimdi eklenmezse sonradan migration ağır olur.

**Öneri**: `workspaces` + `users` + `workspace_members` + her tabloya `workspace_id uuid NOT NULL REFERENCES workspaces(id)`. Row-level security isteğe bağlı.

### 3.4 [P1] Status kolonları `text` — enum olması lazım
`scans.status`, `crawls.status` serbest text. Typo ile çöp değer yazabiliriz. Postgres enum veya check constraint.

### 3.5 [P1] Büyük JSONB'ler ana tabloda
`viewport_results` satırında:
- `dom_snapshot JSONB` (500 element × ~20 alan ≈ 100KB+)
- `axe_results JSONB` (10-500KB)
- `page_html TEXT` (50-500KB)
- `page_css TEXT` (10-200KB)
- `lighthouse_json JSONB` (1-10MB)
- `response_headers JSONB` (küçük)

Toplam satır ~1-11MB. Postgres TOAST'a atar ama her SELECT'te ekstra IO. 1000 scan × 5 viewport × avg 2MB = **10GB tablo**.

**Fix**:
- Büyük alanları ayrı tabloya taşı (`viewport_result_blobs`), lazy load,
- Ya da cold data'yı object storage (S3/MinIO) attach et; DB sadece path tutsun,
- `lighthouse_json`'ı sıkıştır (Postgres zaten TOAST'ta sıkıştırır ama gzip ön-sıkıştırma %60 ek kazanç).

### 3.6 [P1] Veri saklama politikası yok
Her şey sonsuza kadar birikiyor. Delete API var ama "30 gün sonra auto-delete" yok. Disk şişer, ayrıca GDPR uyumu için data retention önemli.

**Fix**: 
- TTL tablosu veya `scheduled_deletions`
- Cron job: `DELETE FROM scans WHERE created_at < NOW() - INTERVAL '90 days' AND workspace.retention_days = 90`

### 3.7 [P1] `issueCount` JSONB — indexleme imkansız
`category_scores.issue_count` bir JSON `{critical, warning, info}`. "En çok critical'ı olan scan'ler" sorgulaması JSONB yoluyla veya full table scan. Integer kolonlar daha iyi.

### 3.8 [P2] `scan_batches.urls JSONB` array olarak
OK, işlevsel — ama join tablosu (`batch_scans`) daha temiz olurdu. Şu an `scans.batch_id` zaten var, yani `scan_batches.urls` redundant.

### 3.9 [P2] Drizzle migration `run-migrations.cjs` hem `.ts` migrate.ts hem `.cjs` ile var
Prod Docker `.cjs` kullanıyor, dev `.ts`. İki ayrı runtime. En az biri drift eder.

**Fix**: Tek dosya (Drizzle'ın kendi CLI'ı ile `drizzle-kit push` yeterli prod'da).

---

## 4. PERFORMANS

### 4.1 [P0] Lighthouse desktop + mobile sıralı çalışıyor
`audit/engine.ts:180-221` — desktop run tamamlanınca mobile başlıyor. Her biri ~30-60s. Scan başına 60-120s gereksiz bekleme.

**Fix**: `Promise.all([runLighthouse(desktop), runLighthouse(mobile)])`. Port çakışmasından kaçınmak için 2. için ikinci Chromium.

### 4.2 [P0] Screenshot tile stitching memory heavy
Sharp composite işlemi stitched buffer'ı RAM'de tutuyor. `22000x8000` tile'lar için GB'lar. Container OOM killed olur.

**Fix**: Sharp `toFile` streaming modu veya `extend` / `composite` yerine incremental write.

### 4.3 [P1] `postgres(connectionString)` pool konfigrasyonu yok
`src/lib/db/index.ts:6` default ayarlar (max 10 connection). Multiple Next.js instance + worker → fast exhaust. Ayrıca dev'de HMR her rebuild'de yeni connection açabilir.

**Fix**: `postgres(url, { max: 20, idle_timeout: 20, prepare: false })` + `globalThis` cache pattern.

### 4.4 [P1] `force-dynamic` her sayfada — statik cache'den yararlanılmıyor
`page.tsx:8`, `scan/history/page.tsx:7`, `crawl/history/page.tsx:7` etc. `export const dynamic = "force-dynamic"`. Dashboard her request'te DB'yi hit ediyor. 5-10s gecikme.

**Fix**: `revalidate = 30` veya streaming + Suspense.

### 4.5 [P1] CSV export all-in-memory
`api/crawls/[id]/export/route.ts` — tüm `crawl_pages` bir defada sorgulanıyor, string concat. 10k sayfalı crawl = 50MB string RAM. Streaming yaparak `ReadableStream` olarak response göndermek gerekli.

### 4.6 [P1] PDF export all-in-memory
`api/scans/[id]/pdf/route.ts` — jsPDF synchronous, tüm issue'ları RAM'de. 500+ issue'lu scan = büyük PDF. 

**Öneri**: Chromium-based PDF (`page.pdf()`) veya `puppeteer-core` — daha iyi tipografi + streaming.

### 4.7 [P1] React'ta O(n²) inline hesaplar
`crawl-tabs.tsx:333-337` — `titleIssues(p, pages)` her row için `allPages.filter(...)` = O(n²). 10k sayfada 100M operation per render.

**Fix**: `useMemo` ile `Map<title, count>` pre-compute.

### 4.8 [P1] AI image payloadları devasa
Screenshots 8000x1920 → base64 encode ~10MB. 3 viewport × 10MB = 30MB upload. Hem yavaş hem pahalı (OpenAI high detail $0.00765 per 170px tile).

**Fix**: AI için thumbnail oluştur (2000px max height), sharp ile aynı capture aşamasında üret. Asıl screenshot UI için kalır.

### 4.9 [P2] Recharts her sayfada bundle'a dahil
`report-overview.tsx` dynamic import etmiyor. Dashboard'da RadarChart yüklü gelir.

**Fix**: `dynamic(() => import('recharts').then(m => m.RadarChart), { ssr: false })`.

### 4.10 [P2] Screenshots lazy load ama intersection observer yok
`<img loading="lazy">` kullanılıyor (`screenshot-gallery.tsx:114`) — native lazy, OK. Viewport tab'da 5 screenshot eş zamanlı load oluyor çünkü aynı anda görünür.

### 4.11 [P2] Database: batch scan insert loop'ta
`api/batches/route.ts:63-71` — 50 URL'lik batch için 50 ayrı `INSERT` + 50 ayrı `addScanJob` serial. Hepsi tek transaction'a ve BullMQ'ya bulk add ile gönderilebilir.

### 4.12 [P2] HTTP cache header'ları API'de yok
Scan detay endpoint'i (`/api/scans/[id]`) aynı veriyi dakikada 20 kere istenebilir (auto-refresh). `Cache-Control: private, max-age=5` ekle.

### 4.13 [P2] Browser Chromium her scan'de yeniden kullanılıyor ama context temizlemiyor
Performance için iyi ama eğer scan Lighthouse yavaşsa next scan'in browser'ı 2 dakika boşta bekler. Idle timeout + cleanup gerekli.

---

## 5. ACCESSIBILITY (Kendi UI'mız)

Kendi dogfood'umuzu yiyelim. Mevcut audit (`docs/AUDIT_REPORT.md`) 11 eksik aria-label bildirmiş; commit log'una göre çoğu çözüldü. Yine de:

### 5.1 [P0] Kendi ürünümüz kendi axe-core tool'umuzdan geçmedi
Bir adım atıp **kendi uygulamamızı scan et**. Shadcn component'ler genelde accessible, ama custom `<button>` + sticky header kombinasyonları ve `confirm()` dialog'lar screen reader'da kötü.

### 5.2 [P1] `confirm()` native dialog — SR çok zor
`delete-scan-button.tsx:18`, `delete-scan-inline.tsx:16`, `scan-history-list.tsx:82` — native `confirm()` kullanıyor. Modern approach: shadcn `Dialog` component'i + focus trap.

### 5.3 [P1] Auto-refresh SR okuyucuyu bozabilir
`BatchAutoRefresh`, `CrawlAutoRefresh` — her 5s `router.refresh()` → sayfa DOM'u değişir → SR re-announce eder. 

**Fix**: `aria-live="polite"` region'a progress metinleri yaz; tüm sayfayı değil. Ya da sadece client-side veri fetch et, DOM'u minimum değiştir.

### 5.4 [P1] `toast` SR announce edilmiyor (varsayılan konfig)
`sonner`'ın `richColors` prop'u görsel; `aria-live` default ama bazı tema'larda bozulabilir. Test et.

### 5.5 [P2] Skip link yok
Keyboard user sidebar'ı her seferinde atlamak zorunda. `<a href="#main-content" class="sr-only focus:not-sr-only">Skip to content</a>` ekle.

### 5.6 [P2] Color contrast — dark mode muted-foreground
`oklch(0.705 0.015 286.067)` üzerine dark bg — kontrast 4.5:1 sınırında. Test et.

### 5.7 [P2] Breadcrumb span'ı için separator aria-hidden
`site-header.tsx:31` `<ChevronRight />` SR okur "right pointing chevron". `aria-hidden="true"` ekle.

### 5.8 [P2] Activity log `<ul>`'si sürekli büyüyor
`scan-progress.tsx:152-166` — SR her yeni event'i okur. `aria-live="polite" aria-atomic="false"` olabilir ama çok gürültülü. Sadece son event'i oku, geçmişi görsel göster.

### 5.9 [P2] `<button>` + `onClick` + `role` yokluğu check
Genelde iyi. Ama SVG annotation'ı `role="button"` veriyor (`annotation-overlay.tsx:70`) — `<g>` element'ine. Screen reader'lar SVG `<g role="button">` desteği tutarsız.

---

## 6. SEO AUDIT (Bizim tool'umuzun SEO kısmı)

### 6.1 [P1] Near-duplicate detection çalışıyor ama UI yok
`crawler/simhash.ts` içinde `findDuplicateClusters` var, `crawl-tabs.tsx`'de çağrılıyor (satır ~1310 civarı). Ama:
- UI'da dedicated tab yok (Duplicates).
- Threshold 10 hard-coded, ayarlanamıyor.

### 6.2 [P1] Crawl'da `lang`, `rel=prev/next`, Twitter Card toplanmıyor
`extractor.ts` OG + hreflang topluyor. Twitter Card (`twitter:*`) yok. `<link rel="next">`/`prev` yok. Doküman dili (`<html lang>`) toplanmıyor.

### 6.3 [P1] Redirect chain yarım
`crawler.ts:223-228` redirect listener ama Playwright `goto` sonrası redirect chain'ini tam almaz (Playwright `response.request().redirectedFrom()` yöntemini kullanmak lazım).

### 6.4 [P1] Mixed content detection yok
HTTPS sayfada HTTP asset yüklüyorsa uyarı yok.

### 6.5 [P1] Content encoding (gzip/brotli) denetlenmiyor
`content-encoding` header'ı parse edilmiyor.

### 6.6 [P2] JSON-LD validation yok
`structuredData` topluyoruz ama doğrulamıyoruz (schema.org type kontrolü, required field'lar).

### 6.7 [P2] Orphan page detection yok
Sitemap'te var ama iç link'te yok → orphan. Henüz hesaplanmıyor.

### 6.8 [P2] Indexability badge yok
`meta robots`, `x-robots-tag`, `canonical`, `http status` kombinasyonundan indexable / non-indexable flag çıkarılmıyor.

### 6.9 [P2] Lighthouse SEO + bizim crawler SEO overlap ediyor ama birleşmiyor
Kullanıcı iki ayrı yerde farklı veri görüyor.

---

## 7. AI LAYER (Enterprise-kritik)

### 7.1 [BLOCKER] Media type (1.2.1'de). Fix önceliği 1.

### 7.2 [P0] Model isimleri eski / typo
`claude.ts:42` `claude-sonnet-4-20250514` — 2025 tarihli. Bugün (2026-04) bundan güçlü modeller var. 
`openai.ts:42` `gpt-4o`, `api/remediate/route.ts:101` `gpt-4o-mini`. `gpt-4o` 2024'te gelmiş bir model; `gpt-5`, `gpt-5-mini`, vb. yeni nesil modellere geçilmeli.

**Fix**: Model tanımlarını `src/lib/ai/models.ts`'e taşı, kullanıcıya settings'te seçtir, env'den override edilebilsin.

### 7.3 [P0] OpenAI `response_format: { type: "json_object" }` verilmemiş
`openai.ts:41-48` JSON dön diyoruz ama model bazen önsöz ekler ("Here's the JSON:..."). `parseAiResponse` regex'li match yapıyor — kırılgan.

**Fix**: 
- OpenAI: `response_format: { type: "json_schema", json_schema: { ... } }` ile typed JSON
- Claude: `tool_use` ile structured output

### 7.4 [P0] AI çağrısı retry / timeout yok
Rate limit veya network hiccup'ta senkron fail → tüm scan "analyzing"de takılır.

**Fix**: `p-retry` + exponential backoff + 60s timeout.

### 7.5 [P0] `parseAiResponse` duplicated (claude.ts ve openai.ts)
Aynı fonksiyon iki yerde. Birinde bug fix'i diğerinde yapılmaz.

**Fix**: `src/lib/ai/parser.ts`'ye taşı.

### 7.6 [P1] Prompt screenshot boyutlarını dimension string olarak veriyor ama koordinat frame belirsiz
`prompts.ts:79-83` "Screenshot Dimensions" olarak veriyor. Ama screenshot 8000px tall, viewport 800px tall. AI "region" döndürdüğünde hangi frame? Viewport mu documentHeight mı?

**Fix**: Prompt'ta "coordinates relative to the full-page screenshot (W × H below)" + actual file dimensions. `dimensions` zaten width/height taşıyor, doğru yönde.

### 7.7 [P1] AI cost tracking yok
`tokens_used` kaydedilmiyor; kullanıcı aylık ne kadar yaktığını göremez.

**Fix**: Response'tan `usage` al (Anthropic / OpenAI dönüyor), DB'ye yaz. Dashboard widget.

### 7.8 [P1] AI remediation Tek seferde tek element
`/api/remediate` — element bazlı tek tek. 100 a11y violation'lı bir sayfa için 100 POST. Batch endpoint eksik.

### 7.9 [P1] Context injection yetersiz
`provider.ts:165-168` Lighthouse failure'ları kısa başlık olarak gönderiyor. Ama AI "low contrast" hakkında gerçek color hex'leri veya DOM selector'ını görmüyor. Spec'te bu var ama implement edilmemiş.

**Fix**: Her a11y violation için axe-core'un `node.html` snippet'ini, target selector'ını, failure summary'sini gönder.

### 7.10 [P1] AI issue'lar severity guarantee etmiyor
Model "critical" yerine "high" dönerse (Claude'un alışkanlığı), parser `|| "info"` ile info'ya düşürür. Cost'u yediğimiz halde kategorik olarak yanlış.

**Fix**: Enum-typed schema + retry on invalid.

### 7.11 [P2] Remediation prompt kendi fallback logic'i ile paralel
`api/remediate/route.ts:6-21` ayrı bir remediation system prompt'u var, `ai/prompts.ts`'den gelmiyor. İki ayrı prompt library, birine güncelleme geldiğinde diğeri eskir.

---

## 8. CODE QUALITY

### 8.1 [P1] Hiç test yok
`package.json` `scripts` → `test` yok. No Jest/Vitest config. No Playwright tests. No snapshot tests.

**Öneri (minimum)**:
- Vitest + utility functions için unit test (`simhash`, `robots.ts`, `scoring.ts`, `mapper.ts`)
- Playwright e2e: scan flow, crawl flow, pdf export
- Integration: audit engine with mock DB

### 8.2 [P1] `any` cast'leri kritik yerlerde
- `audit/engine.ts:80` `as any` (axeResults)
- `api/scans/[id]/pdf/route.ts:109,151` `as any` (jsPDF internals)

**Fix**: Proper tipler. axe-core resmi `AxeResults` tipi var.

### 8.3 [P1] Logging `console.log`/`console.warn`
Structured logging yok. Prod'da log aggregator'a JSON format gerekiyor.

**Fix**: `pino` entegre et, her log'a `scanId`, `workerId`, `level` ekle.

### 8.4 [P1] Error boundary yok
React error boundary hiçbir yerde yok. Bir component throw ederse tüm sayfa beyaz.

**Fix**: `src/app/error.tsx` + `global-error.tsx`.

### 8.5 [P2] ESLint config minimal
`eslint.config.mjs` sadece next vitals + TS. Prettier yok. `import/order`, `@typescript-eslint/no-explicit-any`, `react-hooks/exhaustive-deps` strict değil.

### 8.6 [P2] Pre-commit hook yok
Husky / lint-staged yok. Kötü commit'ler geçer. CI'da type-check otomatize değil.

### 8.7 [P2] `AuditIssueInput` 4 kere tanımlı
`runners/axe-runner.ts:8-19`, `lighthouse-runner.ts:8-18`, `html-runner.ts:8-18`, `css-runner.ts:9-19`, `security-runner.ts:8-18` — aynı interface 5 kere. Her birinde küçük farklar (helpUrl vs yok). 

**Fix**: `src/lib/audit/types.ts`'e çek, tek source-of-truth.

### 8.8 [P2] TypeScript strict mode aktif ama bazı yerlerde `as unknown as X`
**Fix**: Daha iyi narrow etme.

### 8.9 [P2] Boş/stub dosyalar
`audit/rules/accessibility.ts`, `performance.ts`, `seo.ts` — 3 satırlık dead file'lar. Sil.

### 8.10 [P2] `components/report/screenshot-gallery.tsx:109` — `eslint-disable-next-line @next/next/no-img-element`
`next/image` kullanmak daha iyi olurdu ama dynamic URL'lerle karmaşık. OK-ish; en azından `priority`/`sizes`/CDN stratejisi düşün.

### 8.11 [P2] Dosya kullanılan fonksiyonları import sayısı düşük
`annotation-overlay.tsx:70` SVG tabanlı event handling. Accessibility overhead için complex. Basit HTML `<div>` + absolute positioning daha iyi olurdu.

### 8.12 [P2] `crawl-tabs.tsx` 1335 satır — split edilmeli
Mevcut audit doc'u da not etmiş (madde 2.5'te 1240 dedi, şimdi 1335). Her tab kendi component olmalı.

`lighthouse-report.tsx` 735 satır — `LhrView`, `AuditItem`, `MetricCard`, `ScoreGauge` ayrı dosyalara.

### 8.13 [P2] JSDoc / TSDoc yok
Enterprise dokümantasyon için public API'lere `@param`, `@returns`, `@throws` gerekiyor.

---

## 9. UI / UX (Kendi tool'umuzun UX'i)

Mevcut `AUDIT_REPORT.md` çoğu item'ı cover etmiş. Ek olarak:

### 9.1 [P1] Dashboard'dan action'lara drill-down yok
"47 critical issues" kartına tıklayınca filtrelenmiş view'a gitmiyor. Dead stat.

### 9.2 [P1] Scan karşılaştırma yok
Crawl'lar için `/crawl/compare` var, scan'ler için yok. Regression tracking için kritik.

### 9.3 [P1] Baseline / target scoring yok
"Benim target'ım A grade" ayarı yok. Compare to baseline missing.

### 9.4 [P1] Batch'te aggregate issue view yok
Batch sayfası (`scan/batch/[id]`) URL listesi + skor gösteriyor. "50 URL'de toplam 342 critical issue" breakdown yok. Top issue pattern'leri (ortak sorun hangi URL'lerde?).

### 9.5 [P1] Crawl'a cancel yok
Scan'de `POST /api/scans/[id]/cancel` var; crawl'da yok. Uzun crawl'lar durdurulamıyor.

### 9.6 [P1] Error recovery yok
Scan fail'de "Retry" butonu yok (eski scan'i yeni job'a dönüştürecek endpoint gerekir). `scan/[id]/page.tsx:112` "Try Again" → `/scan/new`'e atıyor, URL prefill etmiyor bile.

### 9.7 [P1] Scheduled scans yok
Enterprise olmazsa olmaz. Cron job + BullMQ repeatable job'ları + UI.

### 9.8 [P1] Webhook / notification yok
Scan biter → Slack / email / webhook POST. Enterprise satış argümanı.

### 9.9 [P1] Scan config preset'leri yok
"Quick scan", "Full scan", "Accessibility only" gibi preset yok. Her seferinde 25 device seçilecek gibi.

### 9.10 [P2] Breadcrumb'lar çoğunlukla 2 seviyeli
`Dashboard > Scan Results` — "Which scan?" bilgisi yok. URL/hostname breadcrumb 3. segment olmalı.

### 9.11 [P2] Toast + inline error karışık
Bazı yerler `setSubmitError` ile inline, bazıları `toast.error`. Tutarsız.

### 9.12 [P2] Settings sayfası salt-okunur
Env konfigurasyonunu göstermek güzel ama kullanıcı UI'dan API key giremiyor.

### 9.13 [P2] Data table (`crawl-data-table.tsx`) pagination yok
10k satırlı tablo tek sayfa. Performans ve okunabilirlik.

### 9.14 [P2] Mobile'da bazı tablo'lar overflow
`history-tabs.tsx`, `recent-scans.tsx` hidden sm: kullanmış, OK. Ama `crawl-tabs.tsx` çoğu tab'ı mobile'da kolonları sığdırmak için scroll ediyor. Card-based mobile layout daha iyi olur.

### 9.15 [P2] Dark mode: oklch muted çok düşük kontrast
`oklch(0.274 0.006 286.033)` üstüne `oklch(0.705 ...)` foreground = kontrast düşük.

### 9.16 [P2] Empty state'ler minimal
`crawl-compare` page'de sadece 1 crawl varsa "2 crawl'a ihtiyacın var" mesajı yok; select'te tek item görünür.

---

## 10. DEVOPS / OPS

### 10.1 [P1] `docker-compose.yml` app için healthcheck yok
Postgres/Redis var, app yok.

### 10.2 [P1] No restart policy
Container crash'te bir daha başlamaz. `restart: unless-stopped` ekle.

### 10.3 [P1] Loglar stdout'a gidiyor ama aggregator yok
Prod için Loki/ELK/CloudWatch integration.

### 10.4 [P1] Metrics yok
Prometheus metrics endpoint yok. Scan duration, queue depth, AI cost metric'leri export edilmeli.

### 10.5 [P1] Tracing yok
OpenTelemetry entegre değil. Distributed trace olmayınca scan lifecycle debug ağır.

### 10.6 [P1] Dockerfile Stage 3 duplicate dep manifest
`Dockerfile:21` hard-coded versiyonlarla `package.json` yazıyor. Ana `package.json` değişir, bu eskir. Drift.

**Fix**: Ana `package.json`'ı kopyala, `npm ci --omit=dev` yap.

### 10.7 [P1] Database backup stratejisi dokümante değil
`docker-compose.yml` volume (`postgres_data`) saklıyor. Backup / restore runbook yok.

### 10.8 [P1] Secret management yok
`.env`'le prod'da çalışıyor. Vault / Secrets Manager entegrasyonu.

### 10.9 [P2] CI/CD pipeline yok
GitHub Actions / GitLab CI yok. Her PR'da: type-check, lint, test, build, e2e.

### 10.10 [P2] Container image size
Playwright browser'lar + Node 22 slim = ~1.5GB. Alpine ile kücültülemez (glibc) ama base image'ı `playwright` resmi image'ı olsa daha standart.

### 10.11 [P2] Non-root user ama write izni olan dirs sınırlı
`Dockerfile:56` `uid 1001`. OK. `/app/screenshots` chown edildi. Ama standalone build'de diğer write path'lar var mı kontrol et.

---

## 11. OBSERVABILITY

### 11.1 [P1] Yok denecek kadar az
- No structured logging
- No request IDs propagated from API → worker → DB query
- No Sentry / Rollbar
- No scan duration histogram
- No AI provider latency tracking
- No queue depth alerts

### 11.2 [P1] BullMQ UI yok
`bull-board` veya benzeri dashboard entegre edilmemiş. Queue debug'ı için şart.

---

## 12. EKSIK FEATURE'LAR (Enterprise Seviye Için)

Enterprise bir audit tool'un tipik özellikleri:

### 12.1 Olmayan veya eksik (P1)
1. **Multi-tenancy** — workspace/project ayrımı
2. **User management** — invite, roles (admin, auditor, viewer), SSO/SAML/OIDC
3. **API / SDK** — CI pipeline'ına entegre, external trigger
4. **Scheduled scans** — saatlik/günlük/haftalık cron
5. **Alerting** — score düşerse email/Slack
6. **Baseline / target score**
7. **Scan comparison** (UI)
8. **Webhooks** (outgoing)
9. **Audit log / activity history** (who did what when)
10. **Custom rule authoring** — YAML/JSON'dan özel kural tanımlama
11. **Rule profile / preset management**
12. **PDF white-label** — firma logosu, renk
13. **Excel export** (sadece CSV var)
14. **Notification center** (UI)
15. **Tag/label system** for scans/crawls
16. **Search across all scans** (global search)
17. **Dashboard customization** — widget drag/drop
18. **Usage analytics** — AI cost per user, scan count
19. **Budget alerts**
20. **CI/CD integration** (GitHub action, GitLab template)
21. **Screenshot annotations / comments** (team collaboration)
22. **Issue assignment** (assign fix to team member)
23. **Issue status tracking** (open, in progress, fixed, ignored)
24. **Ignore/suppress rules** (ör. "false positive kabul et")
25. **Diff-aware auditing** (compare with previous deploy)

### 12.2 Yarım implementasyonlar (P1)
- `includePatterns` API'de var, UI'da yok
- Duplicate detection mevcut ama UI yok
- Firefox/WebKit seçilebiliyor ama Lighthouse skorları yok (uyarı veriliyor, feature eksik)
- Batch AI analiz yok (batch içindeki tek scan'ler AI çalıştırıyor)
- AI remediation'ı batch yok

---

## 13. İŞ MANTIĞI SORUNLARI (Business Logic)

### 13.1 Scoring
`scoring.ts:92-93` `Math.max(0, Math.min(100, 100 - deduction))` 
- Kategori başına ayrı deduction → bir kategoride 7 critical = 105 deduction = score 0. 
- Ama `CATEGORY_WEIGHTS` farklı. "1 critical accessibility" = score 85 → overall weighted 0.25*85 = 21. 
- "1 critical forms" = score 85 → overall weighted 0.02*85 = 1.7.

Kullanıcı accessibility'nin category ağırlığını bilmiyor. Enterprise için formül **açık dokümante** edilmeli; ya da Lighthouse gibi endüstri standardını aynen izle.

### 13.2 Grade thresholds tartışmalı
A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F < 60. Lighthouse'un 90/50/0'ı (green/orange/red) değişik. İç tutarlılık: Lighthouse gauge'un rengi 90+ yeşil, ama bizim grade B (80) — farklı renk. Karışıklık.

### 13.3 Severity mapping
- axe critical/serious → bizim critical
- axe moderate → warning
- axe minor → info

OK. Ama:
- Lighthouse audit score 0 → critical; <0.5 → warning; ≥0.5 → info (`lighthouse-runner.ts:52-56`). 
- Lighthouse 0.5-0.89 aralığı "info" oluyor — yani "Images should have alt text" Lighthouse'ta 0.7 score alırsa bizde "info" görünür → axe aynı sorunu "critical" görür. **Aynı issue, iki tool, farklı severity**. Bir de axe + Lighthouse sonucu duplicate gösterilir.

**Fix**:
- Duplicate detection (aynı issue_id / underlying rule)
- Severity'yi tool bazlı değil, **WCAG kriterine göre** belirle
- Performance issue'ları için Lighthouse numeric savings kullanarak kendi severity map'ini üret (ör. "eliminate render-blocking" 1s+ kesinti → critical)

### 13.4 AI Analysis kategorisi ayrı ağırlık
`scoring.ts:133` `ai-analysis` için weight 5 sabit. Kullanıcı AI disable etse skor düşmez (zaten kategori yok), OK. Ama AI enable'lı scan'de skor AI çıktısından etkilenir — AI bazen random olabilir, score fluctuation.

**Öneri**: AI analysis skoru overall'a katılmasın. Informational olarak göster.

---

## 14. ÖNCELİK SIRASI — SPRINT PLANI

### Sprint 0 — Emergency hotfixes (1-2 gün)
1. `.env`'deki OpenAI key'i **revoke et** + yeni key al + Vault/Secrets Manager'a taşı
2. AI media_type: PNG → WebP veya screenshot format'ını PNG'e çevir (section 2.1)
3. `lastLighthouseScores` global'ını kaldır (section 2.2)
4. Duplicate `closeBrowser` çağrısını temizle (section 2.8)
5. Dead kod sil: `runFormChecks`, accessibility/performance/seo stub'ları, `CrawlConfig` unused import

### Sprint 1 — Security foundation (1 hafta)
6. Auth layer (başlangıçta tek-kullanıcı API token yeterli, sonra user model)
7. Rate limiting middleware (Redis-backed)
8. URL allowlist + private IP blocklist + cloud metadata block (SSRF)
9. Chromium sandbox'ı etkinleştir (Docker user namespace)
10. Security headers (next.config rewrites → headers)
11. Postgres/Redis default parolaları production için zorunlu env değişkeni

### Sprint 2 — Architecture fixes (2 hafta)
12. Worker process ayrı — `npm run worker:scan`, `npm run worker:crawl`, docker-compose'a ayrı service
13. Redis pub/sub'a SSE event'leri taşı
14. Random Chromium debugging port + concurrency 3+
15. Browser session isolation (per-scan context)
16. BullMQ retry'da DB state reset
17. Job timeout (ör. 10 dakika)
18. Worker cleanup / zombie reaper

### Sprint 3 — Data & performance (1 hafta)
19. DB index'leri ekle (FK + created_at)
20. Multi-tenancy şeması (workspace_id, user_id)
21. Büyük JSONB'leri ayrı tabloya / object storage'a
22. Data retention policy
23. Lighthouse desktop+mobile paralel
24. Sharp streaming

### Sprint 4 — AI robustness (1 hafta)
25. Structured output (json_schema / tool_use)
26. Retry + timeout + cost tracking
27. Batch AI endpoint
28. `parseAiResponse` birleştir
29. Model versiyonları config'ten gelsin
30. AI image thumbnail (boyut sınırı)

### Sprint 5 — Feature parity (2-3 hafta)
31. Scheduled scans
32. Webhooks
33. Scan comparison UI
34. Baseline / target scoring
35. Ignore/suppress rules
36. Custom rule preset'leri
37. CI integration sample'ları

### Sprint 6 — Observability (1 hafta)
38. pino logging + request IDs
39. Sentry entegrasyonu
40. Prometheus metrics
41. BullMQ dashboard
42. OpenTelemetry trace

### Sprint 7 — QA/testing (sürekli)
43. Vitest unit test'ler
44. Playwright e2e
45. CI pipeline (GitHub Actions)
46. Pre-commit hooks
47. Self-audit — kendi UI'mızı kendi tool'umuzla tara, 0 critical hedefle

---

## 15. "ENTERPRISE GRADE" İÇİN EKSİK MATURITY

Özet olarak: **Şu an bir tek-kullanıcılı, tek makinada çalışan, güvensiz, ama ambitious bir prototype var.** Enterprise etiketinin arkasını doldurmak için:

| Enterprise beklentisi | Şu anki durum |
|-----------------------|--------------|
| Multi-tenant, RBAC | Yok |
| SSO/SAML/OIDC | Yok |
| API with documented contract | Yok (internal REST sadece) |
| SLA / uptime guarantees | Single process, SPOF |
| Scheduled + CI integration | Yok |
| Compliance (SOC2 ready, audit log) | Yok |
| Data residency / retention | Yok |
| Observability (metrics/logs/traces) | console.log only |
| Secret management | `.env` file |
| Disaster recovery | Yok |
| Horizontal scaling | Worker in-process |
| Security (auth, CSRF, SSRF, rate-limit) | Hiçbiri yok |
| Test coverage | %0 |
| Documentation | README boş (create-next-app default), audit docs var |

---

## 16. HIZLI KAZANÇ ÖNERİLERİ (48 saat içinde impact)

1. `.env`'deki key'i revoke et, yenisini secrets manager'a al.
2. AI media_type fix — 2 satır değişiklik, bütün AI feature'ı fix'ler.
3. `next.config.ts`'e security headers ekle — 30 dk.
4. Dead code sil — forms.ts runner, stub file'lar.
5. `lastLighthouseScores` global'ını function arg'a çevir.
6. Chromium debugging portu random'a çevir, concurrency 3'e çıkar.
7. DB FK ve created_at index'leri ekle — migration 10 dk.
8. `confirm()` yerine shadcn Dialog'a geçir (delete flows).
9. Scan retry'da önceki `viewport_results` / `audit_issues`'i sil.
10. Basic rate limiter (upstash ratelimit, 1 saat iş).

Bunlar toplam ~1 tam gün. Tool'un temel kalitesi ve güvenliği bariz artar.

---

## 17. OLUMLU TARAFLAR (Credit Where Due)

Ayıp etmeyelim:
- Modül ayrımı temiz: scanner/audit/ai/crawler net sınırlarla ayrılmış.
- Drizzle schema güzel organize, relations tanımlı.
- axe-core + Lighthouse + HTMLHint + CSS analyzer çoktan entegre — foundation iyi.
- shadcn/Tailwind 4 / Next.js 16 stack modern.
- SSE ile live progress — UX olarak güzel.
- Device preset seti comprehensive (Playwright descriptor'larını aynen kullanmak doğru yaklaşım).
- UI tutarlılığı için `ui-constants.ts` — geçen audit'te kapılar açıldı, iyi iş.
- Annotation overlay + bi-directional hover linking — ileri UX.
- Recovery/cancellation logic scan tarafında var (crawl'da eksik).
- PDF export foundation var.
- Batch scan, crawl compare, site tree — ciddi feature'lar.
- Kod okunaklı, comment'ler ölçülü.

Yani kemik sağlam. Yukarıdakiler "enterprise gerçeği" ile "bugünkü hali" arasındaki boşluk.

---

**Son söz**: Şu haliyle "advanced demo" seviyesinde. Enterprise iddiasını karşılamak için 2-3 ay full-time disiplinli çalışma + en az **Sprint 0, 1, 2'nin** tamamlanması gerekiyor. Sprint 0 (Emergency) 1-2 günde bitirilebilir ve zaten bundan sonrasının önünü açar.

---

*Bu doküman cross-check ile yazıldı; her iddia dosya:satır referansıyla doğrulanabilir. Soru/itiraz/derinleşme için madde numarası ile gel.*
