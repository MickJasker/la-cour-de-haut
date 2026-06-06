# ADR-0002: Reviews stored in own DB, no platform scraper

**Status:** Accepted

## Context

Reviews exist on Airbnb and Natuurhuisje. Automated scraping is the only way to fetch them programmatically — neither platform provides a public API for host reviews. The site requires all content in four languages (NL/EN/FR/DE), and the budget is €0.

Options considered:
- **Scraper** — requires headless browser + proxies on a persistent worker; violates platform ToS; fragile to bot-detection; incompatible with Vercel's free serverless tier.
- **Third-party embed** (Revyoos, EmbedSocial) — single language only; paid tier likely; adds an external data processor (GDPR complication).
- **Own DB, owner-managed** — owner pastes review text from platform notification emails; auto-translate fills EN/FR/DE.

## Decision

Reviews live in the site's own DB. The owner enters them manually (copy-paste from platform email notifications) via `/admin/reviews`, then triggers auto-translate to fill the other three languages. Human-edited fields are protected from being overwritten by later re-translates.

## Consequences

- No scraper dependency; no ToS risk; no headless browser infrastructure.
- Owner spends ~5 minutes per review; volume is low (a few per month).
- Full styling control and 4-language support from day one.
- Phase 2 option: forwarded-email parsing (`reviews@lacourdehaut.fr` via Resend inbound) can reduce manual entry while staying terms-compliant.
