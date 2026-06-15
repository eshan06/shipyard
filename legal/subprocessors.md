> **DRAFT — FOR REVIEW BY [COMPANY]'s LEGAL COUNSEL. NOT LEGAL ADVICE.**
> This template was generated to give counsel a tailored starting point. It has NOT been reviewed by a lawyer.
> Do not publish or rely on it until your counsel has reviewed and adapted it for your jurisdiction(s) and business.
> Search this file for `[[ ]]` placeholders and `> ⚠️ COUNSEL:` callouts — each marks a decision counsel must make.

# Shipyard — Subprocessors

**Operated by:** [[Company Legal Name]] ("**Shipyard**", "we", "us")
**Last updated:** [[Effective date / last-updated date]]
**Version:** [[Subprocessor list version, e.g. 2026-06]]

This page lists the third-party organizations ("**subprocessors**") that Shipyard engages to process personal data on behalf of its customers in connection with the Shipyard service (the "**Service**"). It is incorporated by reference into, and must be read together with, the **Data Processing Addendum** (see `data-processing-addendum.md`) and the **Privacy Policy** (see `privacy-policy.md`).

A "subprocessor" here means a third party engaged by Shipyard that processes **customer personal data** — that is, personal data for which the customer is the controller and Shipyard is the processor (for example, personal data contained in the customer's source code, seed data, databases, environment variables, or runtime behavior of the preview environments Shipyard builds and runs on the customer's behalf). Vendors that only process data for which **Shipyard is the controller** (e.g. our own account, billing, and product-telemetry data) are noted separately in Section 4 and are governed by `privacy-policy.md` rather than the DPA.

> ⚠️ COUNSEL: Confirm the scope statement above matches the controller/processor split used in `data-processing-addendum.md` and `privacy-policy.md`. Shipyard is a **controller** for account data, team/membership data, API tokens, billing/usage metrics, and product telemetry, and a **processor** for personal data contained in customer repositories, seed data, databases, secrets, and preview runtime. Some of the vendors below process BOTH categories (e.g. the hosting/compute provider runs both the control plane and the preview containers). Decide whether such dual-role vendors are listed once or split, and ensure the DPA's "subprocessor" definition is broad enough to cover everyone who can touch processor-side data.

---

## Table of contents

1. [How to use this list](#1-how-to-use-this-list)
2. [Current subprocessors](#2-current-subprocessors)
3. [Notes on specific subprocessors](#3-notes-on-specific-subprocessors)
4. [Service providers for Shipyard-controller data](#4-service-providers-for-shipyard-controller-data)
5. [How we select and govern subprocessors](#5-how-we-select-and-govern-subprocessors)
6. [Notice of changes and right to object](#6-notice-of-changes-and-right-to-object)
7. [International data transfers](#7-international-data-transfers)
8. [CCPA/CPRA and US state-law status](#8-ccpacpra-and-us-state-law-status)
9. [Contact](#9-contact)

---

## 1. How to use this list

- The table in Section 2 is the authoritative list of subprocessors as of the **Last updated** date above.
- Where the Service offers configurable destinations (for example, the **product-analytics / telemetry sink**, which a customer may point at a self-hosted log, a generic HTTP endpoint, or a hosted analytics provider — see `privacy-policy.md`), the subprocessor that actually applies depends on the customer's configuration. Self-hosted or customer-controlled sinks are **not** Shipyard subprocessors; only sinks operated by a third party on Shipyard's behalf are.
- Items marked "(if used)" are categories Shipyard may or may not have engaged. Counsel/ops must confirm which are live and either complete or delete each row.

> ⚠️ COUNSEL: Every `[[placeholder]]` vendor name, location, and transfer mechanism below must be replaced with the **actual** vendor and verified against that vendor's signed contract and Data Processing Agreement before this page is published. Do not infer a vendor's processing locations or transfer mechanism — take them from the vendor's current DPA/sub-processor documentation. An inaccurate subprocessor list is itself a compliance failure (Art. 28 GDPR; CCPA/CPRA service-provider obligations).

---

## 2. Current subprocessors

| Subprocessor | Purpose | Data categories | Processing location / region | Transfer mechanism |
|---|---|---|---|---|
| **[[Cloud / hosting & compute provider]]** | Hosts the Shipyard control-plane API (Fastify), background workers (BullMQ + Redis), PostgreSQL, and the Next.js dashboard; **runs the isolated, ephemeral preview containers (Docker / Kubernetes) that build and execute the customer's application stack** | Customer source code & build artifacts; preview build/runtime data; any personal data contained in the customer's repositories, seed data, or databases; deployment & runtime logs; encrypted secrets (AES-256-GCM); account, team, and usage data | [[Region(s), e.g. eu-/us- regions actually configured]] | [[Transfer mechanism — e.g. EU SCCs (2021/914) + UK Addendum; rely on vendor DPA / EU data-region commitment]] |
| **[[GitHub contracting entity — e.g. GitHub, Inc. (US) or GitHub B.V. (EU); confirm the entity in your signed terms]]** | Source-control integration: GitHub OAuth login, GitHub App installation, repository metadata, pull-request webhook events, commit SHAs, branch names; source of the code Shipyard clones to build previews | GitHub identity (login/handle), repository metadata, PR/webhook event data, commit SHAs, branch names; customer source code accessed via the connected repositories; GitHub App installation token, webhook signing secret, deploy keys | [[Primarily United States — confirm against GitHub's current data-residency / subprocessor docs]] | [[Transfer mechanism — e.g. EU SCCs per GitHub's DPA; confirm UK Addendum and any GitHub data-region program]] |
| **[[Managed Postgres provider]]** *(if used)* | Managed PostgreSQL hosting for Shipyard's primary database | Account, team/membership data, API token metadata, project/preview metadata, usage metrics; may contain personal data submitted by users | [[Region(s)]] | [[Transfer mechanism]] |
| **[[Managed Redis provider]]** *(if used)* | Managed Redis backing the background-worker job queue (BullMQ) | Job/queue payloads (may reference preview, project, and user IDs); transient processing data | [[Region(s)]] | [[Transfer mechanism]] |
| **[[Transactional email provider]]** | Delivery of transactional / notification email (e.g. invitations, build/preview notifications, security and account emails) | Recipient name and email address; message metadata; notification content | [[Region(s)]] | [[Transfer mechanism]] |
| **[[Error monitoring / APM provider]]** *(if used)* | Application error monitoring and performance/APM for the Service | Diagnostic events, stack traces, request metadata, user/team IDs; **may incidentally include personal data captured in error context — scrub/PII-filter** | [[Region(s)]] | [[Transfer mechanism]] |
| **[[Product analytics provider — e.g. PostHog (self-host or cloud)]]** *(only if telemetry is routed to a third-party hosted sink)* | Product analytics / telemetry sink for events such as login, project created, preview deployed (see `privacy-policy.md`) | Telemetry events tied to user/team IDs; device/usage metadata | [[Region(s) — e.g. EU vs US PostHog Cloud; or N/A if self-hosted by Shipyard or by the customer]] | [[Transfer mechanism — N/A if self-hosted; SCCs/region commitment if hosted cloud]] |
| **[[Payment processor]]** *(if billing is enabled)* | Payment and subscription processing for paid plans | Billing contact name, email, billing address, plan/subscription data, payment-method tokens; **Shipyard does not store full card numbers** | [[Region(s)]] | [[Transfer mechanism]] |
| **[[Customer support tool]]** *(if used)* | Customer support ticketing / helpdesk and related communications | Name, email, support correspondence, and any data the user voluntarily includes in a ticket | [[Region(s)]] | [[Transfer mechanism]] |

> ⚠️ COUNSEL: For each row, decide and document (a) whether the vendor acts as a Shipyard **subprocessor** (processor-side, customer data) or merely a **service provider to Shipyard as controller** (Section 4), and (b) the correct cross-border **transfer mechanism** per the data's origin and destination. EU/EEA→third-country transfers typically rely on the EU SCCs (Commission Decision 2021/914) plus, for UK data, the UK International Data Transfer Addendum; do not assume an adequacy decision without confirming it is current. For US data, evaluate whether CCPA/CPRA "service provider" / "contractor" terms (and a prohibition on "selling"/"sharing") are in place. See Sections 7 and 8 and `data-processing-addendum.md`.

> ⚠️ COUNSEL: The **hosting/compute provider** is the most sensitive entry because it runs the customer's **arbitrary, potentially untrusted code** inside the preview containers (see `acceptable-use-policy.md` and the security annex). Confirm the contractual isolation, tenancy, and incident-notification terms with that provider are adequate, and that the DPA flows those obligations down. Shipyard commits to reasonable isolation but disclaims liability for the behavior of customer code — ensure that allocation is consistent across `terms-of-service.md`, `data-processing-addendum.md`, and the security annex.

---

## 3. Notes on specific subprocessors

- **Hosting / compute provider.** This provider underpins the entire platform AND executes customer code in ephemeral preview environments. Personal data contained in the customer's repositories, seed data, or running databases is processed here on the customer's behalf. Secrets are encrypted at rest (AES-256-GCM) and are never returned in plaintext through the API or UI, but they are decrypted in memory at runtime to run the customer's previews — note this in the DPA's technical-and-organizational-measures section.
- **GitHub** GitHub is a **core integration and subprocessor**: it is both the identity provider (OAuth login) and the source of the customer's code (repositories the customer explicitly connects, plus webhook/PR events). A customer cannot use the core preview functionality without connecting GitHub. Shipyard acts only on repositories the customer explicitly connects. GitHub also holds or transmits sensitive material in this flow — the GitHub App installation token, webhook signing secret, and any deploy keys — which counsel should account for in the security annex and `data-processing-addendum.md`.
- **Telemetry sink.** Because the telemetry destination is **configurable** (self-hosted log, generic HTTP endpoint, or a hosted analytics provider such as PostHog), the applicable subprocessor — if any — depends on customer/Shipyard configuration. Keep this row in sync with `privacy-policy.md`.

> ⚠️ COUNSEL: If telemetry can be routed to a **generic HTTP endpoint the customer specifies**, that endpoint is the customer's own infrastructure, not a Shipyard subprocessor — but confirm the data-flow description and responsibility allocation in `privacy-policy.md` so it is clear Shipyard is not subprocessing to an arbitrary third party of its own choosing.

> ⚠️ COUNSEL: Confirm the **exact GitHub contracting entity** that appears in Shipyard's signed terms (e.g. GitHub, Inc. for US-contracted accounts vs. GitHub B.V. for EU-contracted accounts) and use that name in the Section 2 table; the entity, its data-residency posture, and its transfer mechanism are stated as placeholders precisely because they must be taken from GitHub's current DPA/subprocessor documentation, not assumed.

---

## 4. Service providers for Shipyard-controller data

The following may be the same vendors as above but are listed here to the extent they process data for which **Shipyard is the controller** (account, team/membership, API token, billing/usage, and product-telemetry data). These relationships are governed by `privacy-policy.md`, not the DPA, and the GDPR right-to-object mechanism in Section 6 does not apply to them in the same way.

- [[Cloud / hosting & compute provider]] — hosting of Shipyard's own systems and data.
- [[Payment processor]] — billing of Shipyard's customers.
- [[Product analytics provider]] / [[Error monitoring provider]] — Shipyard's own product and reliability analytics.
- [[Transactional email provider]] — Shipyard's account/security communications.

> ⚠️ COUNSEL: Confirm whether this controller-side list should be published here, folded entirely into `privacy-policy.md`, or both. Some customers' procurement teams expect a single combined list; others distinguish strictly between Art. 28 subprocessors and controller-side service providers. Decide and keep one canonical source to avoid drift.

---

## 5. How we select and govern subprocessors

Shipyard engages subprocessors only where it has taken reasonable steps to satisfy itself that the subprocessor provides sufficient guarantees to implement appropriate technical and organizational measures so that processing meets applicable data-protection law (cf. Art. 28(1) GDPR). Before engaging a subprocessor that processes customer personal data, and on an ongoing basis, Shipyard:

1. conducts due diligence appropriate to the data and the risk involved (including, for the **hosting / compute provider**, the additional risk that it runs the customer's **arbitrary, potentially untrusted code** inside isolated preview containers);
2. enters into a written data-processing agreement that imposes on the subprocessor data-protection obligations no less protective than those Shipyard owes to its customers under `data-processing-addendum.md`, including confidentiality, security, assistance, and (where relevant) appropriate cross-border transfer safeguards (cf. Art. 28(2)–(4) GDPR); and
3. remains responsible to its customers for the performance of each subprocessor's obligations to the extent provided in `data-processing-addendum.md`.

> ⚠️ COUNSEL: Confirm this section matches the flow-down, liability, and "remains responsible" language actually used in `data-processing-addendum.md` — Art. 28(4) GDPR requires that the processor remain **fully liable** to the controller for an onward subprocessor's performance, and your commercial terms (liability cap, indemnities) in `terms-of-service.md` must be reconciled with that. Decide how strong an audit/right-to-audit right (if any) you grant customers over subprocessors, and whether you will pass through vendor audit reports/certifications instead. Do not assert specific certifications (e.g. SOC 2, ISO 27001) as facts here or for any subprocessor unless verified — mark "[[if applicable]]" and confirm. See the security annex.

---

## 6. Notice of changes and right to object

We may add, replace, or remove subprocessors as the Service evolves. When we intend to make a change to subprocessors that process **customer personal data**, we will:

1. update this page and its **Last updated** date; and
2. notify affected customers of the addition or replacement of a subprocessor before that subprocessor begins processing customer personal data, by [[notification method — e.g. email to the account's notice address and/or in-product notice and/or this page's subscribe mechanism]], giving at least **[[notice period — e.g. 30 days]]** advance notice.

A customer who has a **reasonable, good-faith objection** based on data-protection grounds may notify us at the address in Section 9 within **[[objection window — e.g. 30 days]]** of the notice. We will work in good faith to address the objection (for example, by offering an alternative or a reasonable change in configuration). If we cannot reasonably resolve the objection, the customer's exclusive remedy is as set out in `data-processing-addendum.md`. This Section is subject to, and qualified by, the subprocessor and change-notice terms of `data-processing-addendum.md`, which control in the event of conflict.

> ⚠️ COUNSEL: Set the **advance-notice period** and **objection window**, and align them exactly with `data-processing-addendum.md`. Decide the notice mechanism (email to account contact vs. requiring customers to subscribe to this page vs. in-product). Decide the consequence of an unresolved objection (e.g. termination of the affected Service component, pro-rata refund, or suspension) — this is a commercial/risk decision, not just legal. Note: an "objection-only-via-subscription" model has been criticized by some EU regulators; consider whether passive page-updates alone satisfy your "notify" obligation under Art. 28(2)/(4) GDPR.

> ⚠️ COUNSEL: For **emergency replacements** (e.g. a subprocessor suffers an outage or security incident and must be swapped immediately), decide whether to reserve a carve-out permitting replacement with concurrent rather than advance notice, and define it consistently with `data-processing-addendum.md`.

To receive advance notice of changes to this list, customers may subscribe at [[subscribe link / mechanism — e.g. a "watch this page" form, mailing list, or in-product setting]]. Subscribing does not replace any notice Shipyard separately owes to a customer under `data-processing-addendum.md`.

> ⚠️ COUNSEL: Decide whether subscription is opt-in self-service or whether Shipyard pushes notice to the account's notice address by default. If you offer no working subscribe mechanism, delete the sentence above rather than leave a dead link, and rely on a push-notice model — but see the prior callout on regulator criticism of subscribe-only notice.

---

## 7. International data transfers

Some subprocessors may process customer personal data outside the customer's home jurisdiction, including outside the EEA, the UK, or Switzerland. Where that occurs, transfers are made under an appropriate safeguard identified in the **Transfer mechanism** column above and as described in `data-processing-addendum.md` and `privacy-policy.md`.

> ⚠️ COUNSEL: Choose and document the **transfer mechanism** per vendor and per data-origin region: EU SCCs (2021/914) for EEA-origin data; the UK International Data Transfer Addendum (or UK IDTA) for UK-origin data; the Swiss addendum for Swiss-origin data; and assess any applicable adequacy decision or framework (e.g. an EU–US framework certification) for currency before relying on it. For US state-law exposure (CCPA/CPRA, and other state privacy laws), confirm "service provider"/"contractor" contractual terms are in place and that no vendor relationship constitutes a "sale" or "share." Coordinate with the transfer-impact-assessment approach used in `data-processing-addendum.md`.

---

## 8. CCPA/CPRA and US state-law status

For personal data subject to the California Consumer Privacy Act, as amended by the CPRA (and analogous US state privacy laws), each subprocessor that processes customer personal data on Shipyard's behalf is engaged as a **service provider** (or, where applicable, a **contractor**) under written terms that, among other things, prohibit the subprocessor from selling or sharing the personal data and from retaining, using, or disclosing it for any purpose other than performing the services. Shipyard does not "sell" or "share" customer personal data (as those terms are defined under the CPRA) in connection with engaging the subprocessors listed above.

> ⚠️ COUNSEL: Confirm this statement is accurate for **every** vendor before publishing — a single ad-supported analytics or advertising integration could turn a "service provider" relationship into a "sale" or "share," and product telemetry routed to a hosted analytics provider is a known sensitive case. Decide whether this section should also speak to other US state laws (e.g. Virginia VCDPA, Colorado CPA, Texas TDPSA) and to the controller-side relationships in Section 4. Reconcile definitions and obligations with `data-processing-addendum.md` and `privacy-policy.md`.

---

## 9. Contact

Questions about this list, or objections under Section 6, should be sent to:

- **Privacy / DPO contact:** [[Privacy/DPO contact email]]
- **Legal notices:** [[Notice email]]

Related documents: `data-processing-addendum.md` · `privacy-policy.md` · `terms-of-service.md` · `acceptable-use-policy.md` · the security annex.

> ⚠️ COUNSEL: Confirm the named contact(s) and whether an EU/UK representative (GDPR Art. 27) or DPO must be designated and listed. Ensure the contact here matches the one in `data-processing-addendum.md` and `privacy-policy.md`.
