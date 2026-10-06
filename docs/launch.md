# Mobile landing release — October 6, 2026

## Editorial decision

The site is one brief encounter: a little truck, a hello, and an invitation from Bruce. The email signup is visible before optional actions at phone widths. Long founder stories, speculative inventory, import detail, and wish-list questionnaires are retired from the public experience. Historical copy remains in Git history.

The primary copy is **Little truck. Big hello.** followed by **See what’s next.** and a brief linked introduction to Bruce. The signup asks for an email only. There is no poll after signup and no claim that a welcome email was sent.

## Storage and owner access

All successful actions are acknowledged only after server-side storage. Email followers and truck inquiries are distinct records and consent purposes in `truck_requests`; love is in `visitor_signals`; photos use `truck_sightings` plus private R2 objects. Open the Site’s settings and database viewer to read records. These managed resources are not presented as resources in Bruce’s personal Cloudflare dashboard.

The requested Gmail forwarding address is `beejeezum@gmail.com`; automatic forwarding is not configured. Cloudflare DNS validation does not provision a mailbox or an outbound sending service. Domain email remains a separate follow-up.

## Verification

- Automated tests use real local SQLite migrations and filesystem image storage: valid submissions, intent separation, duplicate suppression, invalid input, cross-site requests, oversized payloads, private photo access, and recoverable storage failures.
- Browser testing covers a mobile-width email signup, mobile-number truck inquiry, love reaction, and photo upload through the actual frontend.
- The uploaded browser test image is JPEG, 1536×1024, with no EXIF entries after browser re-encoding.
- Both apex domains were reported active with active TLS before this release. The Worker implements the singular-domain redirect and preserves old QR entry routes.

## Deployment boundaries

Use the existing Sites source repository and project. GitHub source mirroring remains blocked: the connected GitHub app reports a wherebyus installation but no Beejeezum installation. Do not report the GitHub repository as updated until a write there succeeds.

`www` domains, domain inboxes, automatic Gmail notifications, and newsletter sending are not configured. The image remains explicitly labeled illustration, and indexing remains disabled. No purchase or paid email subscription has been initiated.


## Owner dashboard update — October 6, 2026 UTC

The public introduction now names The New Tropic, New World Symphony, and The Museum of Self, grounded in Bruce’s current public site (https://brucepinchbeck.com/) and recovered project context. The import invitation follows the user’s current statement that more trucks are being brought over from Japan. No ready-for-sale inventory or delivery dates are invented.

The truck image was edited through image generation to remove its yellow background. The production asset preserves real alpha transparency and is optimized as WebP. The phone layout was inspected with the asset composited on the actual page.

The private `/dashboard` adds a five-second activity feed and owner-only photo viewer, reply links, CSV exports, cumulative interaction totals, 24-hour visit history, and approximate active browsers. Dashboard access is restricted to the owner email verified in the Site access policy through dispatch-owned ChatGPT sign-in. Public visitors and other authenticated accounts are denied all dashboard data. Old `/sighting/` capability links are disabled.

The 0001 migration creates only the new visit table and indexes; previously applied migrations are unchanged. Tests cover owner/anonymous/nonowner/missing-config boundaries, photos and exports, duplicate heartbeats, 90-second presence expiry, and safe export content. Browser preview confirms filtering and existing locally submitted records.

Gmail delivery is still unconfigured. The dashboard provides immediate practical access to submissions without requiring database tools.
