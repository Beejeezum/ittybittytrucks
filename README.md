# Itty Bitty Trucks

One small mobile landing page for someone who spots Bruce’s truck around Boca Raton.

## Experience

The page starts with the truck and a short hello, then offers one email field to follow Bruce’s trucks and local projects. A love reaction, truck information, a one-field truck inquiry, and a private photo upload are secondary actions. Bruce’s name links to https://brucepinchbeck.com.

- Canonical domain: https://ittybittytrucks.com
- Companion domain: https://ittybittytruck.com — permanent redirect to the plural domain
- Old QR route `/hi/teal/` still works. Old content URLs redirect to the relevant landing-page sheet.
- Both apex custom domains have active hosting validation and TLS. `www` hostnames are not configured.

## Run and verify

Use Node.js 24 or newer for the local SQLite preview.

```sh
npm ci
npm run build
npm test
npm run dev
```

The local preview uses its own SQLite database and image directory under `.sites-runtime/local/`, never the production database. After changing source, rebuild and restart the preview server. In the managed Sites environment, `sites-preview` owns starting and stopping the server.

## Source map

- `src/landing.html` — copy, forms, and native dialog sheets.
- `src/landing.css` — phone-first layout, visible focus, and reduced-motion support.
- `src/landing.js` — form validation, confirmed save states, reactions, and photo preparation.
- `worker/index.js` — request validation, persistence, duplicate protection, rate limits, and redirects.
- `db/schema.ts`, `drizzle/` — database schema and generated migrations.
- `scripts/build.mjs` — packages the landing assets and Worker into `dist/server/`.
- `tests/worker.test.mjs` — persistence, validation, failure, privacy, and redirect tests.

## Where submissions go

Production runs on Sites with its managed Cloudflare D1 and R2 storage. Open this Site’s **Settings → database viewer** to inspect its private records, or ask ChatGPT to retrieve them using the connected Sites tools.

| Table | Purpose |
| --- | --- |
| `truck_requests` | Email followers (`intent=follow`) and truck inquiries (`intent=truck`). Includes contact method, contact value, timestamp, and consent purpose. |
| `visitor_signals` | Anonymous love reactions, one per first-party visitor cookie. |
| `truck_sightings` | Private photo metadata. Image bytes live in R2. |
| `submission_limits` | Short-lived hashed request counters for abuse control; no plain IP addresses. |

Photo links can be constructed from a row as `/sighting/{id}/{view_key}`. Treat the random `view_key` like a private sharing secret. No public photo list or contact listing is exposed. Browser uploads are resized to at most 1600 pixels and re-encoded as JPEG to remove EXIF/location metadata before upload.

**Email delivery is not configured.** The desired notification destination is `beejeezum@gmail.com`. The forms save directly to the database; they do not send a welcome email, text, or Gmail notification. Truck inquiries do not enroll someone in community emails. A sending provider or Cloudflare email credential is needed before adding background notifications and newsletter delivery.

## Publishing

This checkout is synced with the existing Sites source repository. Use the Sites workflow to commit and push the exact source, build/package it, save a version, and deploy publicly. Generated `dist/` files and local preview data are excluded from source control. Hosting provisions the `DB` and `BUCKET` bindings and applies generated migrations before uploading the Worker. Never run schema DDL in request handlers.

The separate public `Beejeezum/ittybittytrucks` GitHub repository is currently empty. Its connected GitHub app still lacks an installation for Beejeezum, so copying the source there remains blocked by integration access.

The truck image is labeled as an illustration. No vehicle sale status or price is implied. Search indexing remains disabled pending the final public launch/content decision.
