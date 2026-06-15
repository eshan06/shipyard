> **DRAFT — FOR REVIEW BY [COMPANY]'s LEGAL COUNSEL. NOT LEGAL ADVICE.**
> This template was generated to give counsel a tailored starting point. It has NOT been reviewed by a lawyer.
> Do not publish or rely on it until your counsel has reviewed and adapted it for your jurisdiction(s) and business.
> Search this file for `[[ ]]` placeholders and `> ⚠️ COUNSEL:` callouts — each marks a decision counsel must make.

# Shipyard — Legal Pack (Counsel Index)

This directory contains the legal document set for **Shipyard**, a B2B SaaS "preview environments
manager": for each GitHub pull request, Shipyard clones a customer's repository, **builds and runs
the customer's full-stack application in isolated, ephemeral containers** (Docker / Kubernetes), and
returns a shareable preview URL so teams can review changes before merging.

## Global disclaimer — read first

**Every document in this folder is an unreviewed DRAFT.** Each was generated as a tailored starting
point for Shipyard's specific product and data-processing model — it is **not** legal advice and has
**not** been reviewed by a qualified lawyer. Nothing here may be published, linked from the product,
presented to customers, or relied on until [[Company Legal Name]]'s counsel has reviewed it, resolved
every `> ⚠️ COUNSEL:` callout, filled every `[[ ]]` placeholder, and adapted it to the
jurisdiction(s) in which Shipyard operates and to its actual commercial and technical practices.
Several documents make factual statements about the product (e.g. AES-256-GCM secret encryption,
container isolation, telemetry routing) that counsel and engineering must verify against the live
system before publication. Do not assert any certification (SOC 2, ISO 27001, PCI DSS, HIPAA) as fact
unless and until it is actually held and current.

## The documents

| File | Document | One-line purpose |
| --- | --- | --- |
| [`terms-of-service.md`](./terms-of-service.md) | Terms of Service (Master Subscription Agreement) | The master contract: how the Service may be used, who is responsible for the customer code Shipyard runs, IP, fees, warranties, liability, termination, and dispute resolution. |
| [`acceptable-use-policy.md`](./acceptable-use-policy.md) | Acceptable Use Policy (AUP) | What customers may and may not build, run, and do inside previews — prohibits crypto-mining, DoS, isolation-escape, resource abuse, and unlawful content; incorporated into the ToS. |
| [`privacy-policy.md`](./privacy-policy.md) | Privacy Policy | How Shipyard handles personal data **as a controller** (accounts, GitHub identity, usage, telemetry, billing, B2B marketing). GDPR- and CCPA/CPRA-aware. |
| [`data-processing-addendum.md`](./data-processing-addendum.md) | Data Processing Addendum (DPA) | The Art. 28 / CPRA contract for personal data Shipyard processes **as a processor on the customer's behalf** (data inside repos, seed data, preview databases, secrets). Includes the SCC/IDTA transfer terms and the security-measures annex (Annex II). |
| [`subprocessors.md`](./subprocessors.md) | Subprocessors | The third parties (hosting/compute, **GitHub**, email, analytics sink, etc.) that may process customer personal data, their locations, and transfer mechanisms; the change-notice/objection process. |
| [`cookie-policy.md`](./cookie-policy.md) | Cookie & Similar-Technologies Policy | Cookies and browser storage used by the Shipyard dashboard/marketing site (auth/session, theme, analytics); consent model. Does **not** cover cookies set by customer code inside previews. |
| [`dmca-copyright-policy.md`](./dmca-copyright-policy.md) | Copyright / DMCA Policy | Notice-and-takedown, counter-notice, designated-agent, and repeat-infringer process for copyright complaints about content served through preview URLs; non-US (DSA/UK) overlay. |
| [`COUNSEL_REVIEW_CHECKLIST.md`](./COUNSEL_REVIEW_CHECKLIST.md) | Counsel Review Checklist | Consolidated, de-duplicated checklist of every decision counsel must make and every placeholder to fill, grouped by document. |

> ⚠️ COUNSEL: A security overview/whitepaper is cross-referenced across several documents as
> `security.md` (e.g. in the DPA's DPIA-assistance and audit sections, the AUP, the Cookie Policy,
> and the DMCA Policy). **No such file exists in this folder yet.** Decide whether to author a
> `security.md` (and/or a `SECURITY.md` / `security-policy.md` for responsible-disclosure terms, and a
> `dsa-notice.md` EU notice-and-action contact page), or to remove the cross-references and rely
> solely on **Annex II to `data-processing-addendum.md`** as the authoritative technical and
> organizational measures. Do not publish documents that link to a `security.md` that does not exist.

## Recommended review order

Review in this order, because later documents depend on decisions made in earlier ones:

1. **`terms-of-service.md`** — sets the defined terms, the controller/processor framing, the
   risk-allocation for running customer code, the liability cap, governing law, and dispute
   resolution that the other documents inherit.
2. **`acceptable-use-policy.md`** — incorporated into the ToS; resolve its enforcement/notice
   provisions in step with the ToS suspension/termination clauses.
3. **`data-processing-addendum.md`** — the load-bearing processor contract; depends on the
   controller/processor split agreed in the ToS and drives the subprocessor and transfer analysis.
4. **`subprocessors.md`** — must be populated with real vendors and kept in lockstep with the DPA's
   subprocessor change-notice period and the international-transfer mechanisms.
5. **`privacy-policy.md`** — the controller-side notice; align its retention periods, breach-notice
   timing, legal bases, and transfer mechanism with the DPA and subprocessor list.
6. **`cookie-policy.md`** — depends on the analytics/telemetry and consent decisions made in the
   Privacy Policy.
7. **`dmca-copyright-policy.md`** — independent in substance, but its contacts, governing law, and
   retention must match the ToS and Privacy Policy; requires US Copyright Office agent registration.
8. **`COUNSEL_REVIEW_CHECKLIST.md`** — work through it last as a completeness gate before publication.

## How placeholders and COUNSEL callouts work

- **`[[ Double-bracket placeholders ]]`** mark company-specific facts that must be filled in before
  publication — for example `[[Company Legal Name]]`, `[[Governing law]]`, `[[Venue / dispute forum]]`,
  `[[Liability cap]]`, `[[Data retention period]]`, `[[Notice email]]`, `[[Privacy/DPO contact]]`,
  `[[Effective date]]`. The same placeholder is intended to carry the **same value** everywhere it
  appears, so fill it consistently across all files. Search each file (and the whole folder) for
  `[[` to find them all.
- **`> ⚠️ COUNSEL:` blockquote callouts** mark points that require a legal judgment (governing law,
  arbitration vs. courts, the liability-cap amount and carve-outs, indemnity scope, warranty
  disclaimers, retention periods, the international-transfer mechanism, consumer-law carve-outs, DMCA
  agent registration, breach-notice timing, etc.). Each explains **what** must be decided and **why**.
  Resolve the callout, make the corresponding edit, then delete the callout.
- **`[[if applicable]]`** marks claims (e.g. certifications) that must not be stated as fact unless
  verified true. Confirm or delete.
- The **DRAFT banner** at the top of every file must remain until counsel has signed off; remove it
  only at the moment of publication.

To find outstanding work programmatically, from this folder:

```bash
grep -rn "\[\[" .            # every unfilled placeholder
grep -rn "⚠️ COUNSEL" .       # every unresolved decision
```

## Shipyard's data-protection posture (summary)

The single most important framing across this pack is the **controller / processor split**, which is
stated consistently in `terms-of-service.md` (§4), `privacy-policy.md` (§2), and
`data-processing-addendum.md` (§3):

- **Shipyard is the _controller_** for account and identity data (user name, email, GitHub OAuth
  identity), team/membership and RBAC data, API-token metadata, usage and cost metrics, product
  analytics/telemetry tied to user/team IDs, support, and B2B marketing data. This processing is
  described in `privacy-policy.md`. Shipyard is also the controller for the personal data contained
  in DMCA notices and counter-notices it receives (`dmca-copyright-policy.md` §13).
- **Shipyard is the _processor_** for personal data **contained inside** the customer's repositories,
  source code, environment variables/secrets, seed data, build artifacts, and preview databases —
  which Shipyard clones, builds, runs, and stores **on the customer's behalf and under the customer's
  instructions** to produce a preview. The customer is the controller (or a processor for its own
  controller) for that data. This processing is governed by `data-processing-addendum.md`, **not** the
  Privacy Policy, and is why a DPA is required.

Because previews **execute the customer's arbitrary, potentially untrusted code**, the pack places
responsibility for that code (its legality, security, IP, and content) on the customer, disclaims
Shipyard's liability for customer-code behavior, and commits Shipyard to commercially reasonable
isolation rather than perfect containment. **GitHub** is a core integration and subprocessor.

---

*This index is itself a draft. See the banner above. Last reconciled across the document set on
[[Effective date]].*
