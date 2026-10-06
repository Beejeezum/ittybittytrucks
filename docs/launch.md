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
