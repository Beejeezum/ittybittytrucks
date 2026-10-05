# Itty Bitty Trucks

A little home for Japanese kei trucks, roadside discoveries, and the people who want one.

**Primary domain:** ittybittytrucks.com  
**Companion domain:** ittybittytruck.com  
**Status:** First site concept for review. Custom domains and business email are not activated by this repository.

## Run it

Use Node.js 20 or later. There are no package dependencies to install.

```sh
npm run dev
```

Open `http://localhost:4173`. To rebuild after changing a source file, run `npm run build` and refresh. To serve an existing build, run `npm run preview`.

```sh
npm run build
```

The static site is written to `dist/`. The build creates individual HTML pages and a permanent QR entry route. The output can be hosted by a static host, including Cloudflare Pages, without a framework runtime.

## The first little world

| Route | Purpose |
| --- | --- |
| `/` | A playful welcome for someone who spotted a truck |
| `/trucks/` | Meet the trucks and see an honest inventory empty state |
| `/trucks/teal-sambar/` | Bruce’s 2000 Subaru Sambar TT2 profile |
| `/hi/teal/` | Permanent printed-QR route to the Sambar profile |
| `/tiny-truck-101/` | A sourced introduction and buying questions |
| `/find-me-one/` | A truck wish-list builder |

The wish-list builder currently creates a draft in the visitor’s browser. It can copy the draft, preserve the visitor’s Sambar reference, and return to editing. It does not store or submit personal information, and it does not pretend to have sent an inquiry.

After the business mailbox is verified, set `emailReady` to `true` in `site.config.json` and rebuild. The review screen will then offer an explicit **Email my wish list** action that opens the visitor’s email app. The visitor must send the email. This is not a background form-delivery service.

## Content and launch notes

- [Brand and site plan](docs/brand-and-site-plan.md)
- [Domain email setup](docs/email-setup.md)
- [Launch and content handoff](docs/launch.md)

The visual direction uses large expressive typography, yellow, dark ink, turquoise, and a restrained red accent. The truck art is a clearly illustrated concept asset, not a photograph or exact representation of inventory. Replace the profile illustration with Bruce’s real photographs before treating that page as a finished vehicle presentation.

The Sambar is described as Bruce’s truck, without an invented sale status or price. No additional vehicles, testimonials, sold counts, or business services are assumed. Road-use copy avoids blanket legality claims.

## Editing

- `src/pages/`: individual page content.
- `src/template.html`: shared navigation, document metadata, and footer.
- `src/styles.css`: responsive visual system.
- `src/site.js`: menu, wish-list draft, and copy/email interactions.
- `site.config.json`: canonical domain, contact address, email readiness, and indexing state.
- `assets/`: project images and the initial typographic favicon.
- `scripts/`: dependency-free build and local preview.

`indexable` is deliberately `false` for the initial review draft. Change it only when the actual content, images, contact flow, and domain are ready for public launch. No analytics or third-party form service is included.
