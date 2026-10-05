# Itty Bitty Trucks email setup

**Status: not configured.** This project has not created a Workspace subscription, mailbox, aliases, verification records, or email DNS records. All addresses below are proposed. Account-specific verification tokens and DKIM keys are pending. Confirm completion through the tests below before publishing these addresses as working contact channels.

## Recommended account and cost

Use **one Google Workspace Business Starter user**, with `ittybittytrucks.com` as the primary domain.

| Address | Role | Configuration |
|---|---|---|
| `bruce@ittybittytrucks.com` | Founder correspondence and account sign-in | The single licensed mailbox |
| `hello@ittybittytrucks.com` | Website, truck magnets, customer inquiries | Free alias of Bruce's mailbox |
| `contact@ittybittytrucks.com` | Optional alternative contact address | Free alias |
| `dmarc@ittybittytrucks.com` | Authentication reports | Free alias, filtered into a label |
| Matching addresses at `ittybittytruck.com` | Singular-domain spelling | User alias domain; verify generated addresses |

Google permits up to **30 email aliases per user without additional charges**. Aliases share the primary inbox and are not separate sign-in accounts. Add the singular domain as a **user alias domain** in the same organization so the existing user receives addresses there without a second paid mailbox.

Standard US pricing, checked October 5, 2026:

- **Flexible: $8.40 per month** for one user, without an annual commitment.
- **Annual: $84 per year**, equivalent to $7 per month, with a one-year commitment. Canceling early does not remove the remaining contract obligation.

Taxes and eligible introductory offers are determined at checkout. Flexible is a reasonable starting choice while the business takes shape.

Sources: [Google pricing and commitments](https://knowledge.workspace.google.com/admin/billing/compare-flexible-and-annual-fixed-term-payment-plans), [email aliases](https://knowledge.workspace.google.com/admin/users/add-or-delete-an-alternate-email-address-email-alias), [user alias domains](https://knowledge.workspace.google.com/admin/domains/add-a-user-alias-domain-or-secondary-domain).

## 1. Create and verify the organization

Sign up for Business Starter with **one user**, the existing plural domain, and `bruce@ittybittytrucks.com`. Review the billing plan before completing signup. Use an existing external address for recovery and configure two-step verification.

Before editing DNS, inspect and export the current Cloudflare records for both domains. Check for existing email delivery services. Preserve website A/AAAA/CNAME records, certificate records, and unrelated TXT records.

Google supplies an account-specific ownership record. Add it in Cloudflare using the exact instructions from signup, usually:

| Type | Name | Content |
|---|---|---|
| TXT | `@` | `google-site-verification=<value supplied by Google>` |

**The placeholder is not a usable record.** Obtain the real value from Google, then finish verification in Workspace.

## 2. Route incoming email to Google

For the primary domain, add the current Google Workspace MX record:

| Cloudflare field | Value |
|---|---|
| Type | `MX` |
| Name | `@` |
| Mail server | `smtp.google.com` |
| Priority | `1` |
| TTL | `Auto` |

After reviewing existing delivery, replace conflicting MX records at the same hostname. If Cloudflare Email Routing is enabled, disable its routing configuration before replacing its managed MX records. Do not mix Google and Cloudflare routing MX records. Return to **Admin → Account → Domains → Manage domains → Activate Gmail**.

Google says MX recognition can take up to 72 hours. [Official MX instructions](https://knowledge.workspace.google.com/admin/domains/set-up-mx-records-for-google-workspace).

## 3. Add aliases and the singular domain

In **Admin → Directory → Users → Bruce → Add Alternate Emails**, add `hello`, and optionally `contact` and `dmarc`.

Then open **Account → Domains → Manage domains → Add a domain**. Enter `ittybittytruck.com` and select **User alias domain**. Verify ownership using its generated verification record, add the Google MX record in that domain's Cloudflare zone, and activate Gmail. Inspect **Show all alternate emails** and confirm the desired singular addresses exist.

The website redirect from singular to plural does not configure email delivery. Both domains need their email setup.

## 4. Authenticate outgoing mail

### SPF

If Google Workspace is the only sender, publish this TXT record at `@` on **each domain**:

```text
v=spf1 include:_spf.google.com ~all
```

Keep one combined SPF record per domain. Inspect any existing SPF first; include other legitimate senders only if they actually send for the domain. Website notification or newsletter services may need separate authentication later. [Google SPF setup](https://knowledge.workspace.google.com/admin/security/set-up-spf).

### DKIM

In **Admin → Apps → Google Workspace → Gmail → Authenticate email**, select each domain and generate a **2048-bit** key. Google says new organizations may need to wait **24–72 hours after Gmail activation** before generating it.

Add Google's exact TXT name and public-key value to the corresponding Cloudflare zone. With the default selector, the name is `google._domainkey`. Return to Google and select **Start authentication** after the record is published. Repeat for both domains. Do not invent, reuse, or commit account credentials or private keys. [Google DKIM setup](https://knowledge.workspace.google.com/admin/security/set-up-dkim).

### DMARC

After SPF and DKIM have authenticated successfully for at least 48 hours, start with monitoring. Create the report aliases first, then add TXT at `_dmarc`:

Plural domain:

```text
v=DMARC1; p=none; rua=mailto:dmarc@ittybittytrucks.com
```

Singular domain:

```text
v=DMARC1; p=none; rua=mailto:dmarc@ittybittytruck.com
```

Review reports for at least a week. Correct legitimate senders before gradually moving to `quarantine`, then `reject`. A monitoring policy does not request rejection of unauthenticated messages. [Google DMARC rollout](https://knowledge.workspace.google.com/admin/security/recommended-dmarc-rollout).

## 5. Configure replies and verify

In the Workspace Gmail inbox, open **Settings → Accounts → Send mail as** and add `hello@ittybittytrucks.com`. Use **Itty Bitty Trucks** as its display name. Configure replies to use the address the original message reached. [Google send-as instructions](https://support.google.com/mail/answer/22370).

Before marking email live:

- Send from another account to plural and singular `hello@` addresses; confirm receipt.
- Reply as `hello@`; verify the recipient sees the branded From address.
- Send a founder message from `bruce@` and check its reply path.
- Inspect received message headers for SPF, DKIM, and DMARC passes.
- Test website form delivery separately when that integration exists.
- Confirm website DNS still resolves correctly and record completion dates.

Free Cloudflare routing can forward incoming mail to an existing inbox. Cloudflare also now offers paid SMTP sending in Email Sending Beta, so it is inaccurate to say Cloudflare cannot send. Workspace provides the complete mailbox workflow recommended here. [Cloudflare Email Service](https://developers.cloudflare.com/email-service/).
