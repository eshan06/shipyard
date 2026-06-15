> **DRAFT — FOR REVIEW BY [COMPANY]'s LEGAL COUNSEL. NOT LEGAL ADVICE.**
> This template was generated to give counsel a tailored starting point. It has NOT been reviewed by a lawyer.
> Do not publish or rely on it until your counsel has reviewed and adapted it for your jurisdiction(s) and business.
> Search this file for `[[ ]]` placeholders and `> ⚠️ COUNSEL:` callouts — each marks a decision counsel must make.

# Shipyard Privacy Policy

**Controller:** [[Company Legal Name]] ("**Shipyard**", "**we**", "**us**", "**our**")
**Effective date:** [[Effective date]]
**Last updated:** [[Effective date]]

This Privacy Policy explains how Shipyard collects, uses, discloses, and protects personal data **when Shipyard acts as a controller** — that is, for the personal data we handle to operate the Shipyard service, sign you in, run our business, support you, bill you, secure the platform, and market to business prospects.

> ⚠️ COUNSEL: Confirm the correct contracting/controller entity in `[[Company Legal Name]]`, and confirm whether a single global entity or multiple regional entities (e.g. an EU/UK entity) act as controller. If multiple entities are involved, this policy may need a "which entity is responsible for you" section keyed to the customer's location.

---

## Important: what this policy does and does **not** cover

Shipyard is a B2B "preview environments manager." For each GitHub pull request, Shipyard clones a customer's repository, **builds and runs that customer's application stack in isolated, ephemeral containers** (Docker / Kubernetes), and returns a shareable preview URL so teams can review changes before merging.

Because of this architecture, Shipyard handles two very different kinds of personal data, and **this Privacy Policy only covers the first**:

1. **Data where Shipyard is the controller (covered here).** Account and identity data, usage and log data, product analytics/telemetry, support communications, billing data, and business-to-business marketing data. We decide why and how this data is processed, so we are the controller and this policy applies.

2. **Personal data *contained inside* a customer's repositories, source code, build artifacts, environment variables/secrets, seed data, or preview databases (NOT covered here).** When Shipyard clones, builds, runs, and stores a customer's application and its data to produce a preview, any personal data inside that application is processed **on the customer's behalf and under the customer's instructions**. For that data, **the customer is the controller and Shipyard is the processor**. That relationship is governed by our **Data Processing Addendum** (see [data-processing-addendum.md](./data-processing-addendum.md)), **not** by this Privacy Policy. If you are an end user, employee, or data subject whose personal data appears inside a customer's application running on Shipyard, please contact **that customer** (the controller) to exercise your rights; we will support them as required by the DPA and applicable law.

> ⚠️ COUNSEL: This controller/processor split is the single most important framing in this document and must align word-for-word with the DPA. Confirm we never repurpose customer-application data (Section 2 data) for our own analytics/telemetry/training. If any cross-use exists (e.g. aggregated usage metrics derived from preview runtime), it must be disclosed here and reconciled with the DPA's "documented instructions" limits.

---

## Table of contents

1. [Who we are and how to contact us](#1-who-we-are-and-how-to-contact-us)
2. [Scope and the controller / processor distinction](#2-scope-and-the-controller--processor-distinction)
3. [Personal data we collect and the sources](#3-personal-data-we-collect-and-the-sources)
4. [How telemetry and product analytics work](#4-how-telemetry-and-product-analytics-work)
5. [Purposes of processing and legal bases (GDPR Art. 6)](#5-purposes-of-processing-and-legal-bases-gdpr-art-6)
6. [Cookies and similar technologies](#6-cookies-and-similar-technologies)
7. [How we disclose personal data; subprocessors](#7-how-we-disclose-personal-data-subprocessors)
8. [International data transfers](#8-international-data-transfers)
9. [How long we keep personal data (retention)](#9-how-long-we-keep-personal-data-retention)
10. [How we protect personal data (security)](#10-how-we-protect-personal-data-security)
11. [Data breaches and security incidents](#11-data-breaches-and-security-incidents)
12. [Aggregated and de-identified data](#12-aggregated-and-de-identified-data)
13. [Your privacy rights (GDPR / UK GDPR)](#13-your-privacy-rights-gdpr--uk-gdpr)
14. [US state privacy rights (CCPA/CPRA and similar)](#14-us-state-privacy-rights-ccpacpra-and-similar)
15. [Automated decision-making and profiling](#15-automated-decision-making-and-profiling)
16. [Children](#16-children)
17. [Changes to this policy](#17-changes-to-this-policy)
18. [Contact, complaints, and representatives](#18-contact-complaints-and-representatives)

---

## 1. Who we are and how to contact us

Shipyard is operated by [[Company Legal Name]], a company incorporated in [[Jurisdiction of incorporation]], with its registered/principal address at [[Company registered address]].

For privacy questions or to exercise your rights:

- **Privacy / data protection contact:** [[Privacy/DPO contact]]
- **General notices:** [[Notice email]]

> ⚠️ COUNSEL: Decide whether a Data Protection Officer (DPO) is legally required (GDPR Art. 37 / UK GDPR) given the nature/scale of processing. If a DPO is appointed, name them and their contact. If not, confirm that the generic privacy contact is sufficient and that we are comfortable publishing it. Also see Section 18 on EU/UK Article 27 representatives.

## 2. Scope and the controller / processor distinction

This policy applies to the personal data described in Section 3, which we process **as a controller**, in connection with:

- the Shipyard website and dashboard (Next.js);
- the Shipyard control-plane API (Fastify) and background workers (BullMQ + Redis);
- the Shipyard GitHub App and OAuth login; and
- our sales, support, billing, and marketing activities.

It does **not** apply to:

- personal data inside a customer's repositories, application code, environment variables/secrets, build artifacts, logs generated by the customer's running application, seed data, or preview databases (we are a **processor** for that data — see [data-processing-addendum.md](./data-processing-addendum.md)); or
- third-party websites, identity providers, or services we link to (e.g. GitHub), which have their own privacy notices.

Your use of Shipyard is also governed by our [terms-of-service.md](./terms-of-service.md) and [acceptable-use-policy.md](./acceptable-use-policy.md). Because previews **execute customer-supplied code**, responsibility for that code rests with the customer; nothing in this policy changes those allocations.

> ⚠️ COUNSEL: This policy cross-references sibling documents — [terms-of-service.md](./terms-of-service.md), [data-processing-addendum.md](./data-processing-addendum.md), [subprocessors.md](./subprocessors.md), [cookie-policy.md](./cookie-policy.md), [acceptable-use-policy.md](./acceptable-use-policy.md), and [security.md](./security.md). The DPA in particular is **load-bearing**: it is the only place the processor relationship for customer-application data is actually governed. Before this policy is published, confirm each referenced document exists, is published, and uses consistent defined terms; do not publish this policy referencing a DPA that does not yet exist.

## 3. Personal data we collect and the sources

We collect the following categories of personal data **as a controller**. Some fields relate to identifiable individuals; team/organisation identifiers are included because they are often linked to individuals.

### 3.1 Account and identity data
- Name and email address.
- **GitHub identity** obtained when you sign in with GitHub OAuth: your GitHub login/username, GitHub user ID, avatar, and the OAuth scopes/tokens needed to operate the service.
- **Team and membership data:** the team(s)/organisations you belong to and your **role-based access control (RBAC) role** (owner, admin, member, or viewer).
- **API tokens** you create to access the Shipyard API (we store these in hashed/encrypted form; see Section 10).

*Source:* you, your team administrator, and GitHub (via OAuth).

### 3.2 GitHub integration metadata
When a customer connects a repository, we receive **repository metadata, pull-request webhook events, commit SHAs, and branch names** for the repositories the customer explicitly connects. Shipyard only acts on repositories the customer connects. This metadata can contain personal data (e.g. a committer's GitHub username/email embedded in commit data).

*Source:* GitHub, via the Shipyard GitHub App and webhooks.

> ⚠️ COUNSEL: Some GitHub-sourced fields (e.g. committer name/email in commit metadata, PR author) are personal data we receive as part of operating the controller-level service, while the *contents* of the repository are processor data under the DPA. Confirm the boundary line counsel wants to draw between "integration metadata we hold as controller" (Section 3.2) and "repository contents we hold as processor" (Section 2 / DPA), so the two documents do not overlap or contradict.

### 3.3 Usage, device, and log data
- **Deployment/build logs** and **preview runtime logs** to the extent they relate to platform operation (note: logs generated by the *customer's running application* are processor data under the DPA).
- **Cost and usage metrics** for the previews you run — vCPU, memory, storage, and egress — used for visibility and billing.
- **Technical/device data:** IP address, browser/user-agent, device and OS information, timestamps, request/response metadata, and error diagnostics.

*Source:* automatically, as you use the service.

### 3.4 Product analytics / telemetry events
We collect **telemetry events** describing how the product is used — for example `login`, `project created`, and `preview deployed` — **tied to user and team identifiers**. See Section 4 for how telemetry works and where it can be routed.

*Source:* automatically, from the dashboard, API, and workers.

### 3.5 Support communications
Messages, attachments, and metadata you send when you contact support or sales, and our responses.

*Source:* you.

### 3.6 Billing and transaction data
Plan, subscription status, billing contact details, and transaction records. Payment-card data, where applicable, is handled by our payment processor and we do not store full card numbers.

> ⚠️ COUNSEL: Confirm the billing/payments architecture (e.g. whether a PCI-DSS-scoped processor such as Stripe handles card data and we never touch PANs). Adjust wording and add the processor to [subprocessors.md](./subprocessors.md). Decide whether to state any PCI-DSS posture here — do not claim compliance as a fact without verification.

*Source:* you and our payment processor.

### 3.7 Business-to-business marketing data
Business contact details of prospects and contacts at customer/prospect organisations, marketing preferences, and engagement data (e.g. whether an email was opened), used for B2B marketing consistent with Section 5.

*Source:* you, your organisation, and (where lawful) business contact data providers.

> ⚠️ COUNSEL: Confirm whether we **knowingly** collect any special-category data (GDPR Art. 9) or sensitive personal information (CPRA). The intended design is **no**. If secrets/seed data could contain such data, that is processor data under the DPA, not controller data here — but confirm so we can keep the "we do not intentionally collect sensitive data as controller" position accurate.

## 4. How telemetry and product analytics work

Shipyard emits product-analytics/telemetry events (e.g. `login`, `project created`, `preview deployed`) associated with **user and team IDs** so we can understand product usage, debug issues, prioritise features, and measure reliability.

**Configurable telemetry sink.** Telemetry can be routed to a configurable destination ("sink"). Depending on configuration, the sink may be:

- a **self-hosted log** (kept within Shipyard's own infrastructure);
- a **generic HTTP endpoint**; or
- **PostHog** (a product-analytics service).

Where the sink is a third party (e.g. PostHog or a customer-/operator-configured HTTP endpoint), that recipient acts as our subprocessor or, for self-managed/self-hosted deployments, as a destination chosen by the operator. Current third-party analytics recipients are listed in [subprocessors.md](./subprocessors.md).

> ⚠️ COUNSEL: Decide and document **which analytics processor is actually used in the production hosted offering** (e.g. PostHog vs. self-hosted-only), and:
> 1. whether analytics telemetry relies on **consent** (recommended for EU/UK non-essential analytics — see Section 5/6) or **legitimate interests**, and make this section, Section 5, and [cookie-policy.md](./cookie-policy.md) consistent;
> 2. PostHog's hosting region (EU vs US) for the transfer analysis in Section 8;
> 3. for self-hosted/operator-configured sinks (generic HTTP endpoint), who is the controller of the exported events and whether a separate notice/DPA is needed; and
> 4. whether we offer a telemetry opt-out and how it is surfaced.

## 5. Purposes of processing and legal bases (GDPR Art. 6)

Where GDPR / UK GDPR applies, we rely on the following legal bases.

| # | Purpose | Personal data (Section 3) | GDPR Art. 6 legal basis |
|---|---------|---------------------------|-------------------------|
| a | Create and administer your account; authenticate via GitHub OAuth; manage teams and RBAC; issue/verify API tokens | 3.1, 3.2 | **Contract** (Art. 6(1)(b)) — necessary to provide the service you/your organisation requested |
| b | Operate the core service: clone/build/run previews, return preview URLs, process PR webhooks | 3.1, 3.2, 3.3 | **Contract** (Art. 6(1)(b)) |
| c | Maintain, secure, and troubleshoot the platform; prevent abuse (e.g. crypto-mining/DoS via previews per [acceptable-use-policy.md](./acceptable-use-policy.md)); ensure container isolation | 3.3, 3.4 | **Legitimate interests** (Art. 6(1)(f)) — security and integrity of our service |
| d | Measure cost/usage and bill customers | 3.3, 3.6 | **Contract** (Art. 6(1)(b)); **Legal obligation** for tax/accounting records (Art. 6(1)(c)) |
| e | Product analytics / telemetry to improve and stabilise the product | 3.4 | **Consent** (Art. 6(1)(a)) where analytics cookies/non-essential analytics are used; otherwise **legitimate interests** (Art. 6(1)(f)) — *see Section 4 callout* |
| f | Provide support and respond to enquiries | 3.5 | **Contract** (Art. 6(1)(b)) and/or **legitimate interests** (Art. 6(1)(f)) |
| g | B2B marketing and product communications | 3.7 | **Consent** (Art. 6(1)(a)) where required, otherwise **legitimate interests** (Art. 6(1)(f)) — subject to opt-out |
| h | Comply with law; respond to lawful requests; establish, exercise, or defend legal claims | any | **Legal obligation** (Art. 6(1)(c)) and/or **legitimate interests** (Art. 6(1)(f)) |

Where we rely on **legitimate interests**, we have balanced those interests against your rights and you may object (Section 13). Where we rely on **consent**, you may withdraw it at any time without affecting prior processing.

> ⚠️ COUNSEL: Validate each legal-basis mapping for the target markets. Key calls: (i) analytics — consent vs. legitimate interests, and ePrivacy/cookie-consent requirements for any non-essential storage (Section 6); (ii) B2B marketing — the lawful basis differs across EU member states, UK (PECR soft opt-in), and US (CAN-SPAM opt-out); (iii) whether a Legitimate Interests Assessment (LIA) should be referenced/retained for purposes (c), (e), (f), (g), (h).

## 6. Cookies and similar technologies

We and our providers use cookies and similar technologies for essential functions (e.g. authentication/session, security, load balancing) and, subject to consent where required, for analytics. Details — including categories, named cookies, durations, and how to manage preferences — are in our [cookie-policy.md](./cookie-policy.md).

> ⚠️ COUNSEL: Confirm whether a consent banner / consent-management platform is deployed for EU/UK/Brazil visitors and whether analytics (Section 4) is gated behind it. Ensure this section, Section 4, Section 5(e), and [cookie-policy.md](./cookie-policy.md) are mutually consistent.

## 7. How we disclose personal data; subprocessors

We do **not sell** personal data (see Section 14). We disclose personal data only as follows:

- **Subprocessors / service providers** that help us run Shipyard (e.g. cloud hosting/Kubernetes infrastructure, database/queue infrastructure, analytics, email, support, and billing). A current list is maintained in [subprocessors.md](./subprocessors.md).
- **GitHub**, our core integration and a subprocessor: we exchange OAuth and GitHub App data to authenticate users and operate previews on connected repositories.
- **Within your organisation:** team owners/admins can see member account, role, usage, and activity data consistent with RBAC.
- **Professional advisers, auditors, and in corporate transactions** (e.g. merger, acquisition, financing, or asset sale), subject to confidentiality and this policy.
- **Legal, safety, and rights protection:** to comply with law or valid legal process, enforce our terms ([terms-of-service.md](./terms-of-service.md), [acceptable-use-policy.md](./acceptable-use-policy.md)), or protect the rights, safety, and security of Shipyard, our customers, and the public.

We require service providers to process personal data only on our instructions and to protect it.

> ⚠️ COUNSEL: Keep this list synchronised with [subprocessors.md](./subprocessors.md). Confirm controller-vs-processor status of each recipient and that data-protection terms (Art. 28 / equivalent) are in place with each. Decide our subprocessor-change notice mechanism and reference it consistently across this policy and the DPA.

## 8. International data transfers

Shipyard and our service providers may process personal data in countries other than your own, including the United States. Where we transfer personal data out of the EEA, the UK, or Switzerland to a country without an adequacy decision, we rely on appropriate safeguards, principally the **EU Standard Contractual Clauses (SCCs)** (and the **UK International Data Transfer Addendum / IDTA** for UK transfers), together with supplementary measures where needed.

> ⚠️ COUNSEL: Confirm the actual transfer mechanism(s) and finalise this section. Decide: (i) reliance on SCCs/UK IDTA vs. any adequacy/Data Privacy Framework route (e.g. EU-US DPF certification for relevant US providers); (ii) Swiss addendum if relevant; (iii) whether a Transfer Impact Assessment is required and referenced; (iv) the production hosting region(s) and PostHog/analytics region (Section 4). Provide a way for individuals to request a copy of the safeguards. **Do not claim DPF certification unless verified.**

## 9. How long we keep personal data (retention)

We keep personal data only as long as necessary for the purposes in Section 5, then delete or anonymise it. As general guidance:

- **Account, team, and RBAC data:** for the life of the account and then [[Data retention period]] after closure.
- **GitHub integration metadata / webhook events:** [[Data retention period]].
- **Build/deployment and platform logs:** [[Data retention period]]; ephemeral preview environments and their associated runtime data are short-lived by design and are torn down after the preview's lifecycle.
- **Telemetry / product-analytics events:** [[Data retention period]].
- **Support communications:** [[Data retention period]].
- **Billing/transaction records:** retained as required by tax and accounting law (typically several years).
- **API tokens:** until revoked or the account is closed.

> ⚠️ COUNSEL: Set concrete retention periods for each `[[Data retention period]]`, justify each against its purpose/legal basis (storage-limitation principle), and align with the DPA's deletion-on-termination terms for processor data. Confirm ephemeral-preview teardown timing and whether any logs persist beyond teardown. Confirm statutory minimums for billing/tax records in `[[Jurisdiction of incorporation]]` and key customer markets.

## 10. How we protect personal data (security)

We maintain technical and organisational measures appropriate to the risk, including:

- **Encryption of secrets at rest using AES-256-GCM.** Customer-stored environment variables and secrets are **never returned in plaintext** through the API or UI.
- Encryption of data in transit (TLS).
- **Isolation of preview environments:** each preview runs in isolated, ephemeral containers (Docker / Kubernetes). Because previews **execute customer-supplied, potentially untrusted code**, we apply reasonable isolation controls, but responsibility for the legality, security, IP, and content of customer code remains with the customer (see [terms-of-service.md](./terms-of-service.md) and [acceptable-use-policy.md](./acceptable-use-policy.md)).
- Role-based access control (RBAC) and least-privilege access to production systems.
- Hashing/encryption of credentials and API tokens.
- Logging, monitoring, and abuse prevention (including controls against resource abuse such as crypto-mining and DoS via previews).

Our architecture comprises a control-plane API (Fastify), background workers (BullMQ + Redis), a PostgreSQL database, and a Next.js dashboard, deployed via Docker/Kubernetes. No system is perfectly secure, and we cannot guarantee absolute security. For a fuller description, see [security.md](./security.md) where provided.

> ⚠️ COUNSEL: Decide whether to reference any certifications/attestations (e.g. SOC 2, ISO 27001) — **[[if applicable]]**. Do **not** assert any certification as fact unless it has been achieved and is current. Confirm whether to publish a security/incident-response summary in [security.md](./security.md), and align the breach-notification commitment in Section 11 with GDPR Art. 33/34, US state breach laws, and the DPA's incident-notification clause.

## 11. Data breaches and security incidents

Despite the measures in Section 10, no platform is immune to security incidents — a risk that is heightened because previews **execute customer-supplied, potentially untrusted code** and because customers store **secrets** for use in previews.

- **Personal data we control.** If a personal-data breach affecting data for which **we are the controller** (Section 3) occurs and is likely to result in a risk to your rights and freedoms, we will notify the competent supervisory authority and, where required, affected individuals, in accordance with GDPR Art. 33/34, UK GDPR, and applicable US state breach-notification laws, within the timeframes those laws require.
- **Customer-application data (processor role).** If an incident affects personal data **inside a customer's repositories, secrets, build artifacts, seed data, or preview databases** — for which **the customer is the controller and Shipyard is the processor** — we will notify the affected **customer** without undue delay so the customer can meet its own notification obligations. Those obligations and timelines are governed by [data-processing-addendum.md](./data-processing-addendum.md), not this policy.

> ⚠️ COUNSEL: Confirm the controller-side notification trigger/threshold and timeline (GDPR Art. 33 = "without undue delay and, where feasible, not later than 72 hours" to the supervisory authority; Art. 34 to individuals "without undue delay") and reconcile with each in-scope US state breach law (which vary on definition of breach, harm threshold, AG/regulator notice, and deadlines). Ensure the processor-side "without undue delay" commitment here is **identical** to the DPA's incident clause, and decide whether to commit to a specific number of hours/days to the customer.

## 12. Aggregated and de-identified data

We may create **aggregated, anonymised, or de-identified** information from the data described in Section 3 (for example, total preview counts, build-success rates, or platform-wide reliability metrics that do not identify any individual). Once data has been aggregated or de-identified such that it can no longer reasonably be associated with an identified or identifiable individual, we may use and retain it for any lawful business purpose, including product improvement and benchmarking, and it is no longer subject to this policy. We do not attempt to re-identify de-identified data except to test that de-identification is effective.

> ⚠️ COUNSEL: Confirm (i) that any aggregation/de-identification meets the GDPR "anonymisation" bar (irreversibility) versus mere "pseudonymisation" (which remains personal data), and adjust the wording accordingly; (ii) that aggregated/de-identified data is derived **only** from controller data (Section 3) and **never** from customer-application/processor data (Section 2) unless the DPA expressly permits it; and (iii) the CCPA/CPRA "de-identified" standard and the required public commitment not to re-identify. Reconcile this section with the cross-use limits flagged in the Section 2 callout.

## 13. Your privacy rights (GDPR / UK GDPR)

Subject to conditions and exemptions, individuals in the EEA/UK have the right to: **access**; **rectification**; **erasure**; **restriction**; **data portability**; **object** (including to processing based on legitimate interests and to direct marketing); and to **withdraw consent** at any time where processing is based on consent. You also have the right to lodge a complaint with a supervisory authority (Section 18).

To exercise rights regarding data for which **we are the controller**, contact us at [[Privacy/DPO contact]]. We will verify your identity and respond within the timeframes required by law.

**If your request concerns personal data inside a customer's application/repository/database** (where Shipyard is a **processor**), please contact the relevant **customer** (the controller); we will assist them as required (see [data-processing-addendum.md](./data-processing-addendum.md)).

> ⚠️ COUNSEL: Confirm response timelines (GDPR: generally one month, extendable), identity-verification standard, and any chargeable/refusal grounds for manifestly unfounded or excessive requests. Confirm the request intake channel/process.

## 14. US state privacy rights (CCPA/CPRA and similar)

If you are a resident of California or another US state with a comprehensive privacy law, you may have rights to **know/access**, **delete**, **correct**, and to **opt out of the "sale" or "sharing" of personal information** and of certain **targeted advertising / profiling**, and the right to **non-discrimination** for exercising these rights. Where applicable, "sensitive personal information" carries additional rights.

**Our position on "sale"/"share":** Shipyard does **not** sell personal information for money, and we do **not** "share" personal information for cross-context behavioural advertising as those terms are defined under the CCPA/CPRA.

To exercise US state rights for data we control, contact us at [[Privacy/DPO contact]]. Authorised agents may submit requests where the law permits, subject to verification.

> ⚠️ COUNSEL: Verify the "do not sell/share" position against the **actual** behaviour of analytics/advertising tooling (Section 4/6 — e.g. PostHog config, any ad/marketing pixels), because some configurations can constitute a "sale"/"share" under CPRA even without money changing hands. If any such activity exists, add a "Do Not Sell or Share My Personal Information" mechanism and Global Privacy Control (GPC) handling. Confirm which US state laws (CA, VA, CO, CT, UT, TX, and others) are in scope, whether B2B contact data is covered, sensitive-PI handling, and required disclosures (e.g. categories sold/shared = none).

## 15. Automated decision-making and profiling

Shipyard does **not** use solely automated decision-making that produces legal or similarly significant effects on individuals (GDPR Art. 22). Telemetry and usage analytics (Section 4) are used to improve the product and operate the service, not to make such decisions about individuals.

> ⚠️ COUNSEL: Confirm this remains accurate — in particular that automated abuse/fraud controls (e.g. blocking previews suspected of crypto-mining/DoS) do not amount to Art. 22 automated decisions with significant effects, or if they might, add appropriate safeguards (human review, contest mechanism) and disclosure.

## 16. Children

Shipyard is a **business-to-business developer tool and is not directed to children**. We do not knowingly collect personal data from children. If you believe a child has provided us personal data for which we are the controller, contact [[Privacy/DPO contact]] and we will take appropriate steps to delete it.

> ⚠️ COUNSEL: Set the relevant age threshold(s) for the markets served (e.g. under 13 for COPPA in the US; 13–16 under GDPR Art. 8 depending on member state) and confirm the wording matches the no-children-targeted position.

## 17. Changes to this policy

We may update this policy from time to time. If we make material changes, we will update the "Last updated" date and, where appropriate or legally required, provide additional notice (e.g. by email or in-product). This policy is an **informational privacy notice**, not a contract: we will not treat your continued use of Shipyard as "consent" to any processing for which the law requires separate, freely given consent (e.g. non-essential analytics or marketing), and where re-consent is legally required we will obtain it before relying on the change.

> ⚠️ COUNSEL: Confirm the notice mechanism and any advance-notice period for material changes. Do **not** frame this notice as something users "accept" by continued use for GDPR/UK GDPR purposes — under EU/UK law a privacy notice is informational and consent cannot be inferred from continued use. Decide whether re-consent is required for changes affecting consent-based processing and how it will be captured, and keep any "acceptance by use" language in [terms-of-service.md](./terms-of-service.md) (the contract), not here.

## 18. Contact, complaints, and representatives

- **Privacy / data protection contact:** [[Privacy/DPO contact]]
- **General notices:** [[Notice email]]
- **Postal address:** [[Company registered address]]

**Supervisory authority (EEA/UK).** If you are in the EEA or UK, you may lodge a complaint with your local data protection authority. We would appreciate the chance to address your concerns first.

**EU / UK representatives (Article 27).** [[EU representative — name and address, if appointed]] / [[UK representative — name and address, if appointed]].

> ⚠️ COUNSEL: Determine whether GDPR Art. 27 (EU) and/or UK GDPR Art. 27 representatives are required (i.e. whether we are established in the EU/UK or fall within the offering-goods/services or monitoring triggers). If required, appoint and name them here; if not required, remove the placeholders and state the basis. Also confirm the correct lead supervisory authority position if we have an EU establishment.

---

*See also: [terms-of-service.md](./terms-of-service.md) · [acceptable-use-policy.md](./acceptable-use-policy.md) · [data-processing-addendum.md](./data-processing-addendum.md) · [subprocessors.md](./subprocessors.md) · [cookie-policy.md](./cookie-policy.md) · [security.md](./security.md)*
