> **DRAFT — FOR REVIEW BY [COMPANY]'s LEGAL COUNSEL. NOT LEGAL ADVICE.**
> This template was generated to give counsel a tailored starting point. It has NOT been reviewed by a lawyer.
> Do not publish or rely on it until your counsel has reviewed and adapted it for your jurisdiction(s) and business.
> Search this file for `[[ ]]` placeholders and `> ⚠️ COUNSEL:` callouts — each marks a decision counsel must make.

# Shipyard Legal Pack — Consolidated Counsel Review Checklist

This is a single, de-duplicated worklist of every decision counsel must make and every placeholder
to fill before any document in this folder is published. It is drawn from the `> ⚠️ COUNSEL:`
callouts across all seven legal documents (`terms-of-service.md`, `acceptable-use-policy.md`,
`data-processing-addendum.md`, `subprocessors.md`, `privacy-policy.md`, `cookie-policy.md`,
`dmca-copyright-policy.md`).

**How to use it:** Work the **Cross-cutting decisions** section first — those choices propagate into
multiple documents, so deciding them once avoids internal contradictions. Then work each
per-document section. Tick a box only when the decision is made **and** the corresponding edit (and
placeholder fill) is done in the source file(s) and the related `> ⚠️ COUNSEL:` callout is deleted.

---

## 0. Cross-cutting decisions (decide once, apply to every file)

These affect multiple documents; keep the answer identical across all of them.

- [ ] **Company / contracting entity** — fill `[[Company Legal Name]]`, `[[Company registered
  address]]`, `[[Jurisdiction of incorporation]]` everywhere. Decide whether one global entity or
  multiple regional entities (e.g. an EU/UK entity) contract with / are controller for customers.
- [ ] **Effective / last-updated dates** — set `[[Effective date]]` and `[[Last updated date]]`
  consistently across all documents.
- [ ] **Governing law** — set `[[Governing law]]` (ToS §18.1, DPA §17.3, DMCA footer). Reconcile with
  the EU-SCC-mandated governing law (must be an EU Member State) for transfers (DPA §15.2).
- [ ] **Venue / dispute forum** — set `[[Venue / dispute forum]]` (ToS §18.2, DPA §17.3).
- [ ] **Dispute resolution model** — courts vs. binding arbitration; if arbitration, the
  rules/seat/administrator/number/language; class-action and jury-trial waivers (US-state dependent,
  generally unavailable in EU/UK); informal-resolution step; small-claims/injunctive carve-outs
  (ToS §18.3).
- [ ] **Consumer / local-mandatory-law carve-outs** — even in a B2B product, preserve non-waivable
  consumer and local-law rights and mandatory venue for individuals/micro-enterprises (ToS §2.2, §18,
  §13.3 disclaimer carve-out; AUP §12; DMCA footer). Decide if a consumer carve-out is needed.
- [ ] **Liability cap amount/formula** — set `[[Liability cap]]` and the `[[12]]`-month window (ToS
  §15.2). Decide per-party vs. shared; whether a minimum-dollar floor is needed for free/low-spend
  customers; and confirm the DPA inherits (does not stack on) this cap, including any data-protection
  super-cap or carve-out (DPA §17.1).
- [ ] **Liability carve-outs / exclusions** — decide which liabilities sit outside the cap and/or the
  consequential-damages exclusion (indemnities, payment obligations, AUP/license-restriction breach,
  confidentiality, gross negligence/willful misconduct/fraud, non-excludable statutory liability) and
  draft them (ToS §15.3); add the "nothing limits liability that cannot be limited by law" savings
  clause for the chosen jurisdiction(s) (ToS §15.5).
- [ ] **International data-transfer mechanism** — choose per data route: EU SCCs (2021/914), UK IDTA,
  Swiss adjustments, adequacy, or Data Privacy Framework certification. Complete every bracketed SCC
  election in DPA §15.2 (Module 2/3, Clause 7 docking, Clause 9 option, Clause 11, Clause 17 law,
  Clause 18 forum). Decide if a Transfer Impact Assessment is needed. **Do not claim DPF certification
  unless verified.** Keep consistent across DPA §15, `subprocessors.md` §§2/7, and
  `privacy-policy.md` §8. (DPA §15; Subprocessors §§2,7; Privacy §8; Privacy §3.6.)
- [ ] **Subprocessor change-notice period + objection window + notice mechanism** — set the same
  values in DPA §9.3/§9.4 and `subprocessors.md` §6 (they are currently independent placeholders).
  Decide whether "update the page" alone suffices or an affirmative push (email/feed) is required.
- [ ] **Emergency subprocessor replacement carve-out** — adopt (concurrent notice) or reject; if
  adopted, describe it **identically** in DPA §9.3a and `subprocessors.md` §6; if rejected, delete
  both. Confirm SCC Clause 9 compatibility.
- [ ] **Data-retention periods** — set every `[[Data retention period]]` and reconcile the three
  retention regimes: `privacy-policy.md` §9 (controller data, per category), DPA §13 / Annex I
  (processor data, post-termination return window, logs, backups), and ToS §17.2. Honor
  storage-limitation (GDPR) and CCPA/CPRA deletion duties; describe rolling backup expiry honestly.
- [ ] **Breach-notification timing** — set the processor-to-controller window in DPA §11.1 (`[[48 / 72
  hours]]`) and make the privacy-policy.md §11 processor-side commitment **identical**. Confirm the
  controller-side supervisory-authority/individual triggers and US-state breach-law deadlines (Privacy
  §11). Ensure the IR process (DPA Annex II §9) can actually meet the chosen number.
- [ ] **Controller/processor split** — confirm the split (Shipyard = controller for
  account/auth/billing/telemetry; processor for repo/seed/preview-database contents) is correct and
  that the wording matches **word-for-word** across ToS §4, Privacy §2, DPA §3, Subprocessors scope,
  AUP §6.1, DMCA §3/§13. Confirm telemetry tied to user IDs is never repurposed from processor data.
- [ ] **Preview-URL access-control model** — confirm how preview URLs are protected by default
  (unguessable-only vs. SSO/team-gated vs. optionally public) and align every document that describes
  it: ToS §5.7, AUP §6.3, DPA §8.3, DMCA §1/§4, Cookie §11. This drives security, DMCA, and
  data-exposure risk.
- [ ] **Certifications** — do **not** assert SOC 2, ISO 27001, PCI DSS, or HIPAA as fact anywhere
  unless held and current; keep `[[if applicable]]` until verified (ToS §10; DPA §14.2, Annex II;
  Subprocessors §5; Privacy §10, §3.6). Decide whether to state expressly that the Service is **not**
  HIPAA-compliant / no PHI without a BAA.
- [ ] **`security.md` (and `SECURITY.md` / `security-policy.md`, `dsa-notice.md`)** — decide whether
  to author a published security overview, a responsible-disclosure page, and/or an EU DSA contact
  page, or to remove the cross-references and rely on DPA Annex II. **Do not publish links to a
  `security.md` that does not exist** (DPA §12.2, §14.2; Privacy §10; AUP §1.3, §8; Cookie §11; DMCA
  §1, §7).
- [ ] **Contacts** — fill and keep consistent: `[[Notice email]]`, `[[Privacy/DPO contact]]`,
  `[[Security/abuse email]]` / `[[Security contact email]]` / `[[Abuse email]]`,
  `[[Copyright/DMCA agent contact]]`. Decide whether separate intake addresses are needed (abuse vs.
  security vs. DMCA vs. legal). (ToS §21; AUP §10/§11; DMCA §6/§15; Privacy §1/§18; Subprocessors §9;
  Cookie §13.)
- [ ] **DPO and EU/UK Art. 27 representatives** — determine whether a DPO (GDPR Art. 37) and EU and/or
  UK Art. 27 representatives are required; appoint and name, or remove the placeholders with a recorded
  basis (Privacy §1/§18; Cookie §13; Subprocessors §9; DPA Annex I).
- [ ] **Change / amendment mechanism** — decide notice method and period for material changes and
  whether continued-use acceptance vs. affirmative re-acceptance applies; keep "acceptance by use"
  language in the contract (ToS) and **not** in the informational Privacy Policy. Align ToS §19, AUP
  §12, Cookie §12, DMCA §14, Privacy §17.
- [ ] **Acceptance mechanism** — decide how the Agreement/DPA are formed and accepted (click-through,
  signed Order/MSA, or hybrid) and add any "how this Agreement is accepted" recital (ToS §intro, §1.3;
  DPA §intro).
- [ ] **Self-hosted / BYO-cloud deployments** — decide whether the AUP (esp. the technical-abuse and
  infrastructure-control provisions) and the subprocessor/telemetry framing apply in full to
  self-hosted instances or whether a reduced version applies (AUP §1.3; Subprocessors §1; Privacy §4).
- [ ] **Production / special-category data in previews** — choose the position (non-binding caution vs.
  contractual prohibition vs. prohibition only for Special Categories / high-risk data) and apply it
  consistently in DPA §5.4/§5.5/Annex I, AUP §6.2, and Privacy §3.7/§5.4. Decide whether breach is an
  indemnified event.
- [ ] **Final cross-reference + placeholder sweep** — after edits, run `grep -rn "\[\[" .` and
  `grep -rn "⚠️ COUNSEL" .`; confirm no remaining placeholders/callouts and no broken sibling
  links before publication. (The DPA filename is canonicalized to `data-processing-addendum.md`.)

---

## 1. `terms-of-service.md` — Terms of Service

- [ ] Confirm how the Agreement is formed and accepted; conspicuousness of risk-shifting / LoL /
  arbitration / class-waiver clauses (intro callout, §1.3).
- [ ] Confirm the order-of-precedence ladder, incl. whether the DPA overrides for all purposes or only
  data-protection subject matter, and whether Order terms may override the liability cap (§1.3).
- [ ] Confirm minimum-age statement and whether a consumer carve-out is needed (§2.2).
- [ ] Confirm controller/processor split and that the DPA is executed/deemed accepted before
  processing begins (Art. 28 / CCPA service-provider requirements) (§4.2).
- [ ] Decide SLA/uptime/support commitment and where it lives; if credit-based, make credits the sole
  remedy and reconcile with §§13/15 (§3.5).
- [ ] Add heightened obligations / exclusion for special-category and sector-specific (health/PCI)
  data; consider a no-HIPAA-PHI clause (§5.4).
- [ ] Confirm preview-URL default protection and align §5.7 with the product and Documentation; extend
  §13/§15 disclaimers to data exposed via shared/public preview URLs.
- [ ] Decide commercial-terms location (Order Form vs. inline) and address usage-metered billing
  accuracy/dispute and auto-renewal-disclosure rules (§7.1).
- [ ] Confirm no-refund position and statutory exceptions; reconcile with §16 (§7.2).
- [ ] Set `[[Late-payment interest rate]]`; confirm it is within usury/statutory caps; consider EU/UK
  late-payment regimes (§7.5).
- [ ] Confirm scope of inbound license; **explicitly decide whether Customer Content/Code may be used
  to train ML models or derive aggregated/de-identified analytics** (default = no) and square with DPA,
  Privacy Policy, CCPA/CPRA, GDPR purpose limitation (§8.2).
- [ ] Confirm DMCA/DSA safe-harbor posture and that operational prerequisites are met; reconcile
  takedown/counter-notice mechanics and contacts with `dmca-copyright-policy.md` (§8.8).
- [ ] Decide IP-indemnity scope (patents? worldwide? carve-outs) and whether any
  privacy/data-breach/AUP indemnity from Shipyard is offered; reconcile with the cap (§14.2/§14.3).
- [ ] Set the liability cap amount/formula and floor (§15.2); draft the cap carve-outs (§15.3); add the
  savings clause (§15.5). *(See Cross-cutting.)*
- [ ] Confirm renewal mechanics + `[[Non-renewal notice period]]`; comply with auto-renewal laws
  (§16.1).
- [ ] Decide termination-for-convenience right and refund consequence; reconcile with §7.2 (§16.2).
- [ ] Set `[[Cure period]]` for termination for cause (§16.3).
- [ ] Set `[[Data retention period]]` / `[[Export window]]` and reconcile with DPA and Privacy Policy
  (§17.2). *(See Cross-cutting.)*
- [ ] Choose governing law, venue, and dispute-resolution model; add consumer/jurisdiction carve-outs
  (§18). *(See Cross-cutting.)*
- [ ] Confirm change-notice mechanism and whether material changes need affirmative re-acceptance
  (§19.2).
- [ ] Confirm export-control / sanctions regimes (EAR/OFAC, EU/UK) and tailor restricted-territory and
  restricted-party language (§20.9).
- [ ] Confirm the copyright/DMCA contact matches the registered designated agent and the
  `dmca-copyright-policy.md` contact; ensure a single consistent contact set across ToS, AUP, DMCA
  (§21).

## 2. `acceptable-use-policy.md` — Acceptable Use Policy

- [ ] Confirm incorporation mechanism is consistent with the ToS and signup/checkout flow; decide AUP
  applicability to self-hosted deployments (§1.3). *(See Cross-cutting: self-hosted.)*
- [ ] Confirm the customer-code responsibility + limited-isolation commitment aligns with ToS
  warranty-disclaimer, LoL, and customer indemnity; consider an express rights/licenses warranty
  (§2.3).
- [ ] Specify CSAM mandatory-reporting authority/hotline (e.g. NCMEC) per jurisdiction and
  record-preservation duties; reconcile with DPA/Privacy retention/deletion (§3.2).
- [ ] Decide the policy line on lawful adult content; confirm against payment-provider rules and
  `[[Plan/fees reference]]` (§3.7).
- [ ] Confirm Sections 5.1–5.10 operational controls (outbound restrictions, traffic monitoring,
  metering) match what the platform actually does; disclose any outbound-traffic monitoring
  consistently in Privacy Policy and DPA; avoid over-/under-claiming (§5).
- [ ] Decide whether to prohibit or strongly discourage production / special-category personal data in
  previews; require pseudonymized/synthetic seed data; align with DPA and Privacy Policy (§6.2).
  *(See Cross-cutting.)*
- [ ] Confirm the real preview-URL access-control capability set in §6.3 (§6.3). *(See Cross-cutting.)*
- [ ] Decide whether numeric quotas live in the AUP, ToS, plan/order, or external docs; fill the §7
  quota table placeholders (`[[Concurrent previews quota]]`, `[[vCPU quota]]`, `[[Memory quota]]`,
  `[[Storage quota]]`, `[[Egress quota]]`, `[[Build-minutes quota]]`, `[[Auto-stop / TTL value]]`,
  `[[API rate limit]]`, `[[API token quota]]`); confirm overage billing matches the ToS (§7).
- [ ] Decide whether to offer a security-research **safe harbor** (CFAA/DMCA §1201/foreign equivalents)
  and reconcile it with the no-isolation-breaking prohibition (§5.6); decide bug-bounty scope and
  whether a separate `SECURITY.md` hosts canonical disclosure terms (§8). *(See Cross-cutting:
  security.md.)*
- [ ] Confirm enforcement actions and with/without-notice standard mirror ToS suspension/termination;
  decide law-enforcement cooperation standard and its interaction with the DPA's
  notify-controller-before-disclosing duty; confirm any service-credit/refund consequences and
  consistency with LoL/SLA (§10).
- [ ] Decide whether one `[[Abuse email]]` suffices or separate intake addresses are needed; confirm
  designated-agent / Art. 27 requirements; confirm response-time commitments are intentional (§11).
- [ ] Confirm change/notice mechanism and acceptance model consistent with ToS and consumer-protection
  rules (§12). *(See Cross-cutting: change mechanism.)*
- [ ] Reconcile every defined term with ToS, DPA, and Privacy Policy so no term is defined two ways
  (§13).

## 3. `data-processing-addendum.md` — Data Processing Addendum

- [ ] Confirm execution/incorporation method (click-through, signed exhibit, or standalone) and align
  the precedence clause and Annex I "Parties" / signature block (intro callout, §17.2).
- [ ] Confirm the controller/processor boundary for account-admin name/email and GitHub identity vs.
  repository/seed/preview-database contents; ensure DPA and Privacy Policy do not contradict,
  especially on user-ID-tied telemetry (§3.3). *(See Cross-cutting.)*
- [ ] Decide the production-personal-data position in previews (caution vs. prohibition vs.
  special-category prohibition); decide whether breach is indemnified; align with AUP and the cap
  (§5.4). *(See Cross-cutting.)*
- [ ] Decide whether Special Categories are accepted at all; if not, consider making §5.5 a firm
  prohibition and align Annex I (§5.5; Annex I).
- [ ] Confirm the §8.3 shared-responsibility boundary matches the product (preview-URL access
  controls); disclose if preview URLs are guessable/public-by-default (§8.3). *(See Cross-cutting.)*
- [ ] Set the subprocessor change-notice period (§9.3) and align exactly with `subprocessors.md` §6
  and the SCC Clause 9 option; decide notice mechanism (page update vs. push) (§9.3). *(See
  Cross-cutting.)*
- [ ] Decide the emergency-replacement carve-out (§9.3a) and mirror it in `subprocessors.md` §6, or
  delete both (§9.3a). *(See Cross-cutting.)*
- [ ] Set the objection window and confirm the termination-without-penalty remedy; consider pro-rata
  refund (§9.4).
- [ ] Decide whether Sections 10–12 assistance is free or chargeable at documented cost; align with
  `[[Support/SLA terms]]` (§10.1).
- [ ] Set the breach-notification window `[[48 / 72 hours]]` (§11.1); ensure it is identical to Privacy
  §11 and meets the SCCs; confirm operations can meet it. (§11.1.) *(See Cross-cutting.)*
- [ ] Confirm/replace the security-document name used in §12.2 and §14.2; do not reference a doc that
  does not exist (§12.2). *(See Cross-cutting: security.md.)*
- [ ] Set the post-termination return window and operational retention periods (logs, usage, audit
  logs, backups); describe rolling backup expiry honestly; align with `[[Data retention period]]` in
  Privacy Policy (§13.3). *(See Cross-cutting.)*
- [ ] Do **not** represent SOC 2 / ISO 27001 / any certification unless held; keep `[[if applicable]]`;
  decide whether to commit to a certification timeline (§14.2).
- [ ] Decide audit cost allocation, frequency caps, and whether on-site audits are permitted for a
  multi-tenant SaaS; ensure SCC Clause 8.9 consistency (§14.3/§14.4).
- [ ] Complete all SCC elections and confirm hosting/transfer facts (§15). *(See Cross-cutting:
  transfer mechanism.)*
- [ ] Confirm Service-Provider (vs. Contractor) CPRA characterization and mandatory flow-down terms;
  add other US-state processor terms (VCDPA, CPA, TDPSA, etc.) as the customer base requires (§16).
- [ ] Confirm the DPA inherits and does not stack the Agreement cap; decide any data-protection
  super-cap/carve-out; note SCC Clause 12 liability to data subjects is not limitable inter-party
  (§17.1). *(See Cross-cutting: liability.)*
- [ ] Reconcile the Agreement governing-law/forum with the SCC-mandated EU law/forum; make the carve-out
  explicit (§17.3).
- [ ] **Annex I:** identify actual SCC signatories with addresses and contacts; add affiliates; confirm
  Art. 27 representative (Annex I.A).
- [ ] **Annex I:** confirm the open-ended "any Personal Data in seed/preview DBs" category is
  acceptable or require Customer to specify/limit it; tighten with the §5.4 position (Annex I.B).
- [ ] **Annex I:** keep Special Categories defaulted to "none" (or list + safeguards if changed); do
  not leave blank-but-permissive (Annex I.B).
- [ ] **Annex I:** identify the competent supervisory authority per SCC Clause 13 (rule vs. fixed
  authority) (Annex I.C).
- [ ] **Annex II:** confirm `[[TLS version/policy]]` and whether DB/volumes are encrypted at rest;
  state only verified facts (AES-256-GCM for secrets is verified) (Annex II §1).
- [ ] **Annex II:** state the **actual** container-isolation boundaries (namespaces/networks, quotas,
  seccomp, rootless/sandboxed runtimes) without overstating multi-tenant separation; cross-reference
  AUP and ToS (Annex II §2).
- [ ] **Annex II:** confirm internal admin access controls (MFA, SSO, PAM) and the custody/rotation of
  the master `SECRETS_ENCRYPTION_KEY` (Annex II §3).
- [ ] **Annex II:** confirm security monitoring/alerting and log retention; ensure PII-bearing logs are
  access-controlled and retained no longer than necessary (Annex II §4).
- [ ] **Annex II:** confirm backup schedule, encryption, retention, and restore testing; reconcile with
  §13.4 (Annex II §5).
- [ ] **Annex II:** populate SDLC/vuln-management and pen-test cadence with real practice; do not claim
  a cadence/cert not in place (Annex II §6).
- [ ] **Annex II:** confirm personnel security training / background checks where lawful (Annex II §7).
- [ ] **Annex II:** ensure the §11 breach commitment is supported by the referenced IR runbook
  (detection, on-call, escalation, customer-notification owner) (Annex II §9).
- [ ] **Annex III:** ensure `subprocessors.md` is complete/accurate and in sync with §15 and Annex I;
  confirm pointer-by-reference is acceptable to enterprise customers or inline at execution (Annex III).

## 4. `subprocessors.md` — Subprocessors

- [ ] Confirm the scope statement matches the DPA/Privacy controller/processor split; decide whether
  dual-role vendors are listed once or split; ensure the DPA "subprocessor" definition covers everyone
  touching processor-side data (§intro).
- [ ] Replace **every** `[[placeholder]]` vendor name, location, and transfer mechanism with the
  actual, verified vendor (from each vendor's signed DPA/subprocessor docs) before publishing (§1, §2).
- [ ] For each row, classify subprocessor vs. controller-side service provider, and set the correct
  transfer mechanism (§2). *(See Cross-cutting: transfer mechanism.)*
- [ ] Confirm hosting/compute provider contractual isolation, tenancy, and incident-notification terms
  are adequate and flow down; align the customer-code allocation across ToS/DPA/security annex (§2).
- [ ] Confirm exact GitHub contracting entity (e.g. GitHub, Inc. vs. GitHub B.V.) and its
  residency/transfer posture (§2/§3).
- [ ] Confirm the generic-HTTP-endpoint telemetry sink is framed as customer infrastructure, not a
  Shipyard-chosen subprocessor; sync with Privacy Policy (§3).
- [ ] Decide whether the controller-side service-provider list (§4) is published here, folded into
  Privacy Policy, or both; keep one canonical source (§4).
- [ ] Confirm the select/govern language matches the DPA flow-down/"remains fully liable" (Art. 28(4));
  decide subprocessor audit rights / report pass-through; no unverified certifications (§5).
- [ ] Set advance-notice period and objection window and the unresolved-objection consequence; align
  with DPA; decide notice mechanism; address EU-regulator criticism of subscribe-only notice (§6).
  *(See Cross-cutting.)*
- [ ] Decide the emergency-replacement carve-out consistently with the DPA, or remove it (§6). *(See
  Cross-cutting.)*
- [ ] Provide a working subscribe mechanism or delete the dead-link sentence and rely on push notice
  (§6).
- [ ] Choose and document the transfer mechanism per vendor/region; coordinate with the DPA TIA
  approach (§7). *(See Cross-cutting.)*
- [ ] Confirm the no-sale/no-share statement is accurate for every vendor (watch ad-supported analytics
  / hosted analytics as a possible "sale"/"share"); decide other US-state coverage; reconcile with
  DPA/Privacy (§8).
- [ ] Confirm contact(s) and whether an Art. 27 representative / DPO must be listed; match
  DPA/Privacy (§9).

## 5. `privacy-policy.md` — Privacy Policy

- [ ] Confirm the controlling/controller entity and whether single global vs. multiple regional
  entities; add a "which entity is responsible for you" section if needed (§intro).
- [ ] Ensure the controller/processor framing aligns word-for-word with the DPA; confirm no
  repurposing of customer-application data for analytics/telemetry/training (§2). *(See Cross-cutting.)*
- [ ] Confirm every referenced sibling document exists and uses consistent terms before publishing
  (§2 callout). *(Cross-references reconciled; confirm `security.md` decision — see Cross-cutting.)*
- [ ] Decide whether a DPO is required and name them, or confirm the generic contact suffices (§1).
  *(See Cross-cutting: DPO/Art. 27.)*
- [ ] Confirm the boundary between GitHub "integration metadata held as controller" (§3.2) and
  "repository contents held as processor" (DPA) (§3.2).
- [ ] Confirm billing/payments architecture (PCI-scoped processor; no PANs stored); add the processor
  to `subprocessors.md`; decide any PCI posture statement (§3.6).
- [ ] Confirm no knowing collection of special-category (Art. 9) / sensitive PI (CPRA) as controller
  (§3.7).
- [ ] Decide the production analytics sink (PostHog vs. self-hosted), the consent vs. legitimate-
  interests basis, PostHog hosting region, generic-sink controllership, and telemetry opt-out; make
  §4, §5(e), and `cookie-policy.md` consistent (§4).
- [ ] Validate each legal-basis mapping (analytics consent vs. LI; B2B marketing across EU/UK PECR
  soft opt-in / US CAN-SPAM); reference/retain LIAs where relied on (§5).
- [ ] Confirm whether a consent banner/CMP is deployed for EU/UK/Brazil and whether analytics is gated;
  keep §4, §5(e), §6, and `cookie-policy.md` consistent (§6).
- [ ] Keep the disclosure/subprocessor list synced with `subprocessors.md`; confirm Art. 28 terms with
  each recipient; set subprocessor-change notice mechanism consistently (§7).
- [ ] Finalize the international-transfers section and provide a way to request safeguards; do not claim
  DPF unless verified (§8). *(See Cross-cutting: transfer mechanism.)*
- [ ] Set concrete retention periods for each `[[Data retention period]]`, justify each, align with the
  DPA; confirm ephemeral teardown timing and statutory billing/tax minimums (§9). *(See Cross-cutting:
  retention.)*
- [ ] Decide whether to reference certifications (`[[if applicable]]`); decide whether to publish a
  security/incident summary; align the breach-notice commitment with §11 (§10). *(See Cross-cutting.)*
- [ ] Confirm the controller-side breach trigger/threshold/timeline (GDPR Art. 33/34 + US-state laws)
  and make the processor-side commitment identical to the DPA (§11). *(See Cross-cutting: breach
  timing.)*
- [ ] Confirm aggregation/de-identification meets the GDPR anonymization (not pseudonymization) bar and
  the CCPA/CPRA de-identified standard; ensure derived only from controller data; commit not to
  re-identify (§12).
- [ ] Confirm DSAR response timelines, identity-verification standard, refusal/charge grounds, and
  intake channel (§13).
- [ ] Verify the "do not sell/share" position against actual analytics/advertising behavior; implement
  a "Do Not Sell or Share" mechanism + GPC handling if any activity qualifies; confirm in-scope US
  state laws and B2B-data coverage (§14).
- [ ] Confirm no Art. 22 automated decision-making with significant effects (incl. automated
  abuse/fraud blocking); add safeguards/contest mechanism if needed (§15).
- [ ] Set the relevant children's age threshold(s) (COPPA <13; GDPR Art. 8 13–16) (§16).
- [ ] Confirm the change-notice mechanism; do not frame the notice as something accepted by continued
  use; capture re-consent where legally required (§17). *(See Cross-cutting: change mechanism.)*
- [ ] Determine whether EU and/or UK Art. 27 representatives are required and the lead-supervisory-
  authority position; name or remove with basis (§18). *(See Cross-cutting: DPO/Art. 27.)*

## 6. `cookie-policy.md` — Cookie & Similar-Technologies Policy

- [ ] Confirm the consent analysis treats **local storage** under the same EU/UK test as cookies
  (ePrivacy/PECR) (§1).
- [ ] Decide the consent model per jurisdiction and confirm how the four categories map to the banner
  (§2). *(See Cross-cutting / Privacy §6.)*
- [ ] Confirm the disclosed `sy_session` lifetime matches the implemented `SESSION_MAX_AGE_SECONDS`
  (currently 30 days); update for any "remember me" / token-refresh behavior (§3).
- [ ] Confirm whether production uses sticky-session affinity and the exact load-balancer cookie name /
  provider; otherwise delete the bullet and the Section 7 row (§3).
- [ ] Validate the "strictly necessary" classification of `sy_session`, `sy_oauth_state`, and any LB
  cookie against current EDPB / national-DPA guidance (§3).
- [ ] **Engineering:** verify the actual `next-themes` storage key (default `theme` unless overridden)
  before publication (§4).
- [ ] Do **not** publish the onboarding / UI-preference bullets and their Section 7 rows until
  engineering confirms each ships and provides the exact key (currently the only client-side functional
  storage is the theme key) (§4, §7).
- [ ] Decide the EU/UK treatment of client-side functional storage set on load (low-risk preference vs.
  gate behind consent vs. national exemption) (§4).
- [ ] Confirm which telemetry sink is used in production for the relevant audience; ensure the banner
  blocks analytics in the EU/UK until consent; confirm PostHog cookie/IP/transfer behavior matches
  Privacy/Subprocessors; decide the US-state position; re-assess if the sink changes (§5).
- [ ] Confirm the no-advertising/targeting statement remains accurate; treat any added ad/retargeting
  pixel as a trigger to rewrite §6 and implement opt-out/GPC + EU/UK opt-in (§6).
- [ ] Run a live cookie/storage scan of the production dashboard **and** marketing site in each
  shipped sink configuration; reconcile against the Section 7 table; remove non-applicable placeholder
  rows (§7).
- [ ] Decide whether a CMP/consent banner is needed and its geo-gating (strict EU/UK opt-in vs. US
  notice+opt-out), and whether a banner is needed at all under the default self-hosted sink (§8).
- [ ] Confirm the B2B nuance (authenticated employer users still trigger individual-device consent
  duties) (§8).
- [ ] Decide whether to include browser-vendor deep links or generic guidance (§9).
- [ ] State the DNT position; implement mandatory GPC handling if any processing is a sale/share;
  reconcile with Privacy Policy (§10).
- [ ] Confirm the preview-subdomain architecture and that cookie domain scoping isolates preview
  cookies from `sy_session`; align with the security annex (§11). *(See Cross-cutting: preview URL /
  security.md.)*
- [ ] **Engineering:** confirm the negative assurances in §11.1 (no secrets/tokens/decrypted env vars
  written to browser storage or non-`HttpOnly` cookies) against the implementation (§11.1).
- [ ] Decide what counts as a "material change" triggering re-consent (§12). *(See Cross-cutting:
  change mechanism.)*
- [ ] Populate or remove DPO / Art. 27 contact lines consistently with Privacy Policy (§13). *(See
  Cross-cutting: DPO/Art. 27.)*

## 7. `dmca-copyright-policy.md` — Copyright / DMCA Policy

- [ ] Confirm the safe-harbor framework relied on (DMCA §512(c), and whether §512(a)/(b)/(d) also
  apply given how previews are built/cached/served) (§intro).
- [ ] Decide whether preview URLs are public/unauthenticated or access-controlled; cross-check against
  the security overview and ToS (§1). *(See Cross-cutting: preview URL.)*
- [ ] Ensure the responsibility allocation + user IP warranties + IP indemnity match the ToS (§3).
- [ ] Confirm what records persist after preview teardown and whether receipt of a notice triggers a
  litigation hold overriding automatic deletion; align with Privacy/DPA retention (§4).
- [ ] Confirm operations implement the §512(c)(3)(B)(ii) "prompt attempt to contact" step for partially
  compliant notices; set deficiency-outreach wording/turnaround (§5).
- [ ] Decide notice intake (web form vs. email vs. both), English-only requirement, "expeditious"
  SLAs, and whether to log notices for the repeat-infringer tally at intake (§5).
- [ ] **Register the Designated Agent with the U.S. Copyright Office** (dmca.copyright.gov) and renew
  every 3 years; publish the agent details on the website matching the registration exactly; fill
  `[[Designated DMCA agent — name/title/email/mailing address/phone]]`; assign a renewal-calendar
  owner; decide individual vs. role mailbox vs. third-party agent (§6).
- [ ] Confirm separate routing for trademark / abuse / privacy / general-legal notices so DMCA traffic
  is isolated (§6).
- [ ] Confirm acting on "facially valid" notices without merits review fits the chosen safe-harbor
  posture and the ToS disclaimers/LoL; confirm staff can locate reported material without breaking
  tenant isolation or inspecting secrets (§7).
- [ ] Decide the forwarding/redaction practice for complainant contact details (GDPR/UK GDPR
  minimization when forwarding identity to an accused customer) (§7).
- [ ] Confirm reciting the §512(g)(2)(C) "10–14 business day" window and operationalize "restoration"
  for ephemeral previews (e.g. lift suspension / allow redeploy rather than restore a destroyed
  artifact) (§8).
- [ ] Set the repeat-infringer strike threshold `[[e.g. three]]` and lookback `[[e.g. twelve months]]`,
  name the human decision-maker, and ensure the policy is actually executed and logged; decide
  counting of counter-noticed/withdrawn notices and willful vs. inadvertent weighting (§9).
- [ ] Determine which non-US regimes apply (EU DSA notice-and-action, statements of reasons, single
  point of contact, possible legal-representative; UK e-Commerce); decide whether a separate
  `dsa-notice.md` / EU contact is warranted; fill `[[EU/UK content / legal point of contact]]` (§11).
  *(See Cross-cutting: security.md / DSA docs.)*
- [ ] Confirm the controller framing for notice data, set `[[Notice/takedown record retention period]]`,
  identify the GDPR lawful basis, decide forwarded vs. redacted complainant data, address
  special-category/cross-border issues, and reconcile with Privacy CCPA/CPRA disclosures (§13).
- [ ] Confirm the change-notification mechanism is consistent with the ToS amendment clause (§14).
  *(See Cross-cutting: change mechanism.)*
- [ ] Confirm governing law/venue consistency with the ToS; note DMCA / §512(f) arise under US federal
  law regardless of the contractual choice; decide any consumer-protection carve-out (footer).

---

## Final publication gate

- [ ] All `[[ ]]` placeholders filled (`grep -rn "\[\[" .` returns nothing).
- [ ] All `> ⚠️ COUNSEL:` callouts resolved and removed (`grep -rn "⚠️ COUNSEL" .` returns nothing).
- [ ] No unverified certification or factual claim about the product remains.
- [ ] All sibling cross-references resolve to files that exist (no dead links; `security.md` /
  `dsa-notice.md` / `SECURITY.md` either authored or de-referenced).
- [ ] Defined terms, the controller/processor split, contacts, dates, retention periods, the liability
  cap, the transfer mechanism, and the subprocessor notice period are identical across all documents.
- [ ] DRAFT banner removed from every file at the moment of publication.
- [ ] Designated DMCA agent registered (and renewal calendar set), if claiming §512(c) safe harbor.

---

*This checklist is itself a draft and is not exhaustive of all legal issues; it consolidates the
callouts present in the document set. See the banner at the top of this file.*
