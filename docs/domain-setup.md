# Connect the Itty Bitty Trucks domains

Prepared October 5, 2026. The site is already published for public visitors at https://ittybittytrucks-draft.bruchando.chatgpt.site. Both bare domains have been added to the existing Sites project. The latest hostname and certificate status is **pending validation**; Cloudflare DNS has not been changed in this session.

## What connects to what

Cloudflare remains the domain registrar and DNS provider. Sites continues to host the website. The DNS records below send visits for each domain to the existing site and prove control of the hostname. GitHub source synchronization is independent of this connection and is not a prerequisite for domain activation.

## Cloudflare instructions

Open https://dash.cloudflare.com, select the domain, then **DNS → Records → Add record**. Use the record values for that domain below. Use **TTL: Auto**. Both A records must be **DNS only**, with a gray cloud. TXT records are DNS only automatically.

Inspect existing records at `@` before changing them. Replace conflicting old website A, AAAA, or CNAME destinations at the root; do not remove MX records, email authentication records, or unrelated TXT records. Public DNS inspection was unavailable in this execution environment, so no claim is made about which records currently exist.

### ittybittytrucks.com

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | `@` | `162.159.143.30` | DNS only |
| A | `@` | `172.66.3.26` | DNS only |
| TXT | `_openai-site-verification` | `openai-site-verification=SfomYAgMa5HrIAeSxlRC_0KfOIW1-UXx9CRT8LfvkwQ` | DNS only |
| TXT | `_cf-custom-hostname` | `d4487a3a-2a7e-409c-88db-ac72330c0216` | DNS only |

### ittybittytruck.com

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | `@` | `162.159.143.30` | DNS only |
| A | `@` | `172.66.3.26` | DNS only |
| TXT | `_openai-site-verification` | `openai-site-verification=CYyT0JZRDV1wZubhNIUpLZBDkbNUJNWid_NG-zE5Sqs` | DNS only |
| TXT | `_cf-custom-hostname` | `60a383f4-2c6d-4812-9891-2a005b253374` | DNS only |

The values above came from this project's native custom-domain registration and were re-read October 5, 2026. They are specific to these domain registrations; do not interchange the two TXT values. If a hostname is removed/recreated or the host requests fresh validation, read its current values again.

Do not add the host's alternative CNAME target alongside these apex A records. An existing proxied A/AAAA at the same name can cause all addresses there to be treated as proxied, so verify that the root has no stale orange-cloud address records.

## Verify activation

After saving DNS, refresh each custom domain's status through Sites. Both the hostname status and SSL certificate status must be active. If the host supplies additional certificate-validation records, use the exact returned values. Blank validation placeholders are not usable DNS records.

Open HTTPS for each domain after activation, then verify the homepage, `/our-story/`, and `/hi/teal/`. The latter is the permanent route intended for a printed magnet or card.

These settings connect both bare domains to the same site. A singular-to-plural redirect has not yet been configured. `www.ittybittytrucks.com` and `www.ittybittytruck.com` are separate hostnames and have not been registered with the host. Set those up separately if desired.

Once the plural domain and actual contact flow are ready, update `site.config.json` to use `https://ittybittytrucks.com`, review the content and real photographs, then enable indexing and republish. Mailbox setup is separate; the website's contact feature remains in draft mode until the business inbox is ready.

## Official references

- [Cloudflare: Manage DNS records](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/)
- [Cloudflare: Apex proxying and customer A records](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/apex-proxying/setup/)
- [Cloudflare: Proxy status](https://developers.cloudflare.com/dns/proxy-status/)
- [Cloudflare: How O2O works](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/saas-customers/how-it-works/)
