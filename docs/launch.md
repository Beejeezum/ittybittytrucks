# Launch and content handoff

## Current state

The first responsive site draft is built in this repository. It contains a home page, truck directory, Sambar encounter page, introductory guide, and wish-list builder. It is not yet deployed to either purchased domain. No paid email subscription has been started and no DNS records have been changed.

The draft is intentionally excluded from indexing. It uses an illustrative turquoise mini-truck image because the existing user-uploaded photos could not be retrieved during this session. The illustrated truck is brand concept art, not a factual vehicle photo. Its proportions and equipment should not be used as evidence of Bruce’s vehicle specifications.

## Recommended domain map

| Address | Destination |
| --- | --- |
| `ittybittytrucks.com` | Canonical site |
| `www.ittybittytrucks.com` | Redirect to the canonical site |
| `ittybittytruck.com` and `www.ittybittytruck.com` | Permanent redirect to the plural domain, preserving path and query string |
| `ittybittytrucks.com/hi/teal` | Sambar profile, using the included changeable QR route |

The singular-domain redirect must be configured at the host or in Cloudflare redirect rules. A DNS record alone does not perform an HTTP redirect. Website redirects and email aliases are separate configurations.

The build output includes `_redirects` and a static HTML fallback for `/hi/teal/`. Confirm redirect behavior on the selected host before printing a physical QR code.

## Before publishing

1. Add the original Sambar photographs. Confirm permission for every image and remove unwanted identifying details before publication.
2. Confirm the Sambar’s descriptive copy and profile equipment. Add exact transmission, drivetrain, A/C status, dimensions, and vehicle history only when verified.
3. Confirm whether the Sambar is simply a personal profile or actually offered for sale. The current site uses only “Bruce’s truck.”
4. Add any newly purchased truck only after the purchase, manufacturing date, condition, specifications, location, and sale status are confirmed. No pending Acty purchase is listed.
5. Create and test the business mailbox using [email-setup.md](email-setup.md). Then set `emailReady` to `true`. This activates an email-draft link on the wish-list review screen.
6. If a true background submission form is desired, replace the explicit email-draft action with a supported server-side endpoint that validates and stores or delivers requests. Show success only after confirmed acceptance. The current draft does not include that service.
7. Connect the repository to the chosen static host, use `npm run build`, and publish `dist/`. On Cloudflare Pages, those are the build command and output directory; complete account authorization and custom-domain setup in the host.
8. Connect the primary domain, configure HTTPS and companion-domain redirects, and verify navigation at the actual public domain.
9. Change `url` in `site.config.json` from the private draft address to `https://ittybittytrucks.com`, set `indexable` to `true`, and rebuild once the site is ready. Review all page titles, canonical URLs, external sources, and the 404 page.
10. Test the actual QR destination on a phone before ordering magnets or stickers.

## Listing content model

For every truck offered for sale, provide its own genuine photos; make, model, year and manufacturing date; chassis/model code; mileage with unit and verification caveats; transmission; drivetrain; working A/C; condition and known defects; asking price and included/excluded fees; present location; import-document and title status; and a clear inquiry action. Avoid generic “street legal everywhere” or “highway ready” badges.

## Asset record

`assets/kei-illustration.webp` is an AI-generated gouache-style concept illustration created for this project on October 5, 2026. The request was for a visibly hand-painted turquoise Japanese cab-over mini pickup on yellow, with white wheels, restrained texture, no text, no scenery, and no photorealism. It was generated with the built-in Imagegen tool and converted to WebP for the site. This image is not a real vehicle photograph or a precise drawing of a 2000 Sambar.

The original image remains available in the creating conversation. Actual user photographs are the preferred replacement for the vehicle profile and all inventory listings.
