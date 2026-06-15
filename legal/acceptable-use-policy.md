> **DRAFT — FOR REVIEW BY [COMPANY]'s LEGAL COUNSEL. NOT LEGAL ADVICE.**
> This template was generated to give counsel a tailored starting point. It has NOT been reviewed by a lawyer.
> Do not publish or rely on it until your counsel has reviewed and adapted it for your jurisdiction(s) and business.
> Search this file for `[[ ]]` placeholders and `> ⚠️ COUNSEL:` callouts — each marks a decision counsel must make.

# Shipyard — Acceptable Use Policy (AUP)

**Operated by [[Company Legal Name]] ("Shipyard", "we", "us", "our").**
**Effective date: [[Effective date]]**
**Version: [[AUP version / revision tag]]**

This Acceptable Use Policy (the "**Policy**" or "**AUP**") governs your use of the Shipyard preview-environments
service and all related software, APIs, dashboards, GitHub App, command-line tooling, and documentation
(collectively, the "**Service**"). It applies to every customer, account owner, team member, API-token holder, and
anyone who accesses the Service through your account or your connected repositories.

Shipyard is a **preview-environments manager**: for each GitHub pull request you connect, Shipyard clones, builds,
and **runs your application stack** (web, API, database, cache, workers) inside isolated, ephemeral containers and
returns a shareable preview URL. **Because the Service executes code that you supply, this Policy is unusually
important: it defines the limits on what you may build, run, and do inside those preview environments.**

---

## Table of contents

1. [Applicability and incorporation](#1-applicability-and-incorporation)
2. [Your core responsibility for code you run](#2-your-core-responsibility-for-code-you-run)
3. [Prohibited content](#3-prohibited-content)
4. [Prohibited activities (general)](#4-prohibited-activities-general)
5. [Prohibited technical abuse (preview-specific)](#5-prohibited-technical-abuse-preview-specific)
6. [Lawful data processing inside previews](#6-lawful-data-processing-inside-previews)
7. [Resource, rate, and fair-use limits](#7-resource-rate-and-fair-use-limits)
8. [Security research and responsible disclosure](#8-security-research-and-responsible-disclosure)
9. [Responsibility for your end users and downstream customers](#9-responsibility-for-your-end-users-and-downstream-customers)
10. [Enforcement](#10-enforcement)
11. [Reporting abuse](#11-reporting-abuse)
12. [Changes to this Policy](#12-changes-to-this-policy)
13. [Definitions](#13-definitions)

---

## 1. Applicability and incorporation

1.1 **Part of the agreement.** This Policy is incorporated by reference into, and forms part of, the Shipyard
Terms of Service (see `terms-of-service.md`) and any order, plan, or subscription you enter into with us. Capitalized
terms not defined here have the meaning given in the Terms of Service. If there is a direct conflict between this
Policy and the Terms of Service, the Terms of Service govern unless they expressly defer to this Policy.

1.2 **Who is bound.** You are responsible for ensuring that everyone who uses the Service under your account —
including team members in any role (owner, admin, member, viewer), holders of your API tokens, and anyone who can
trigger a build through a repository you have connected — complies with this Policy. A violation by any such person
is treated as a violation by you.

1.3 **Related documents.** This Policy works together with:
- **see terms-of-service.md** — the master agreement and enforcement/termination framework;
- **see privacy-policy.md** — how Shipyard processes personal data as a controller;
- **see data-processing-addendum.md** (the "**DPA**") — how Shipyard processes, **as a processor on your behalf**,
  personal data contained in your repositories, seed data, databases, and preview runtime; the authoritative
  technical and organizational security measures are set out in **Annex II to the DPA**;
- **see subprocessors.md** — the third parties (including GitHub) we rely on;
- **see cookie-policy.md** — the cookies and similar technologies used by the Shipyard dashboard;
- **see dmca-copyright-policy.md** — how we handle notices of alleged copyright/intellectual-property infringement;
  and
- any **published security overview** (where available) — a non-authoritative summary of the isolation measures
  referenced in this Policy. The authoritative measures are those in Annex II to the DPA.

> ⚠️ COUNSEL: Confirm the exact mechanism of incorporation (incorporated-by-reference vs. click-through acceptance
> vs. both) is consistent across **see terms-of-service.md** and the signup/checkout flow. If the Service is also
> offered via a self-hosted or "bring-your-own-cloud" deployment, decide whether this AUP applies in full to
> self-hosted instances (where Shipyard does not operate the compute) or whether a reduced version applies — the
> technical-abuse provisions in Section 5 assume Shipyard-operated infrastructure.

> ⚠️ COUNSEL: This Policy points the authoritative security/isolation measures to **Annex II of the DPA** and treats
> any standalone security overview (sibling drafts referred to a possible `security.md`) as a non-authoritative summary
> "where available". **Do not publish a link to a `security.md` (or `SECURITY.md` / `security-policy.md`) that does
> not exist** — either author that document and use a single, consistent file name across all documents
> (**see privacy-policy.md**, the DPA, **see cookie-policy.md**, **see dmca-copyright-policy.md**), or remove the
> "published security overview" references here and rely solely on Annex II to the DPA. If a separate responsible-
> disclosure page is published (see the Section 8 callout), cross-reference it by its exact final file name.

---

## 2. Your core responsibility for code you run

2.1 **You own and are responsible for your code.** Shipyard does not write, choose, audit, or vet the application
code, container images, build steps, dependencies, scripts, environment variables, Secrets, or seed data that you
submit to be built and executed in a Preview Environment (collectively, your "**Customer Content**", which includes
your "**Customer Code**", as those terms are defined in the Terms of Service). You are solely responsible for all of
it, including its legality, security, intellectual-property status, and behavior at runtime. This Section restates,
and does not limit, the customer responsibilities and warranties in the Terms of Service (**see terms-of-service.md**).

2.2 **Shipyard executes untrusted-by-default code.** The build and preview environment will run arbitrary code that
originates from you and from the pull requests opened against your connected repositories — including code authored
by external contributors whom you may not control. You are responsible for governing which repositories you connect,
which branches and pull-request sources are allowed to trigger previews, and what such code is permitted to do. We
strongly recommend you do not connect repositories, or enable previews for pull-request sources, that you are not
prepared to have built and executed on our infrastructure.

2.3 **Isolation is reasonable, not absolute.** Shipyard commits to applying commercially reasonable measures to
isolate Preview Environments from one another and from our control plane (the authoritative technical and
organizational measures are set out in Annex II to **see data-processing-addendum.md**; see also any published
security overview as described in Section 1.3, and Section 5). However, isolation is a shared responsibility: it does
not relieve you of the obligation to keep dangerous, malicious, or unlawful behavior out of the code you run. Nothing
in this Policy is a warranty that any sandbox is impenetrable. This is consistent with the warranty disclaimers in the
Terms of Service (**see terms-of-service.md**), under which the Service is provided on an "as is" / "as available"
basis and Shipyard does not warrant that isolation will prevent all escape, interference, or data exposure caused by
Customer Code.

> ⚠️ COUNSEL: This Section allocates responsibility for customer code to the customer and pairs it with a limited
> isolation commitment. Confirm it aligns with (a) the warranty disclaimer and limitation-of-liability clauses in
> `terms-of-service.md`, and (b) the customer indemnity covering claims arising from customer code/content. Decide
> whether to add an express customer warranty that it has all rights and licenses necessary for the code, images,
> dependencies, and data it submits.

---

## 3. Prohibited content

You must not use the Service to build, run, store, transmit, host, or distribute any of the following ("**Prohibited
Content**"):

3.1 Content that is illegal under any law applicable to you or to us, or that promotes or facilitates illegal acts.

3.2 Child sexual abuse material (CSAM) or any content that sexually exploits or endangers minors. We report such
content to the appropriate authorities and/or hotlines as required by law, and preserve associated records.

> ⚠️ COUNSEL: Specify mandatory-reporting obligations and the relevant authority/hotline for each jurisdiction
> (e.g., NCMEC in the United States). Confirm record-preservation duties and how they interact with the retention and
> deletion commitments in the DPA and `privacy-policy.md`.

3.3 Malware, ransomware, spyware, rootkits, worms, viruses, exploit kits, or other malicious code intended to harm,
surveil, or gain unauthorized access to any system — including hosting or distributing such code to third parties via
a preview URL. **Note:** controlled possession of such code as a defensive-security test fixture inside your own
isolated repository may be permissible; weaponizing the Service to deliver it to others is not (see Section 8).

3.4 Content used for phishing, credential harvesting, or other fraudulent deception, including pages that impersonate
a brand, login screen, or person to obtain credentials, payment information, or other sensitive data.

3.5 Content that infringes or misappropriates a third party's intellectual-property or proprietary rights, including
copyright, trademark, patent, trade-secret, or rights of publicity. You represent that you have the rights and
licenses necessary to clone, build, run, and display the repositories and artifacts you submit.

3.6 Content that is defamatory, harassing, threatening, or that incites violence; content that unlawfully discriminates
against or targets individuals or groups; or content that violates a person's privacy.

3.7 Sexually explicit content involving adults where its hosting or distribution would violate applicable law or our
payment providers' rules.

> ⚠️ COUNSEL: Decide the policy line on lawful adult content. Many B2B infrastructure providers prohibit it outright
> for payment-processor and reputational reasons even where legal. Confirm against the rules of the payment provider
> referenced in `terms-of-service.md` and the `[[Plan/fees reference]]`.

3.8 Content prohibited by applicable export-control or sanctions laws, or that you are not permitted to process or
make available to the recipients of a preview URL.

---

## 4. Prohibited activities (general)

You must not use the Service to:

4.1 Violate any applicable law, regulation, court order, or third-party right, or facilitate another person in doing
so.

4.2 Gain unauthorized access to, probe, scan, or test the vulnerability of any system, network, or account that you
do not own or are not expressly authorized to test (except as permitted by Section 8).

4.3 Send, relay, or facilitate unsolicited bulk or commercial messages ("spam"), or operate an email-sending,
SMS-sending, or other messaging relay from a preview for the purpose of mass or unsolicited outreach.

4.4 Engage in fraud, deceptive trade practices, money laundering, or the sale of illegal or restricted goods or
services.

4.5 Misrepresent your identity or affiliation, including spoofing GitHub identities, forging headers, or impersonating
Shipyard, its staff, or any other person or organization.

4.6 Interfere with, disrupt, degrade, or impose an unreasonable load on the Service, our infrastructure, our other
customers, or any third party — including the activities specified in Section 5.

4.7 Resell, sublicense, or provide the Service to third parties except as expressly permitted by the Terms of Service,
or use the Service to build a competing preview-environments product by copying its functionality.

4.8 Remove, disable, circumvent, or interfere with any security, authentication, rate-limiting, quota, billing, or
access-control mechanism of the Service.

---

## 5. Prohibited technical abuse (preview-specific)

Because previews **execute your code on our compute**, the following are specifically prohibited regardless of whether
the underlying code is otherwise lawful. These activities harm the platform, other tenants, and third parties even
when no "content" rule is broken.

5.1 **Cryptocurrency mining and equivalent abuse.** You must not run cryptocurrency miners, proof-of-work hashing,
distributed-computing payloads, GPU/CPU-farming, or any workload whose primary purpose is to consume compute to
generate value (crypto or otherwise) rather than to preview an application change. This applies whether the workload
runs in the build step, the preview runtime, a worker, or a sidecar process.

5.2 **No general-purpose hosting, compute, CDN, or storage.** Previews are short-lived, automatically torn down, and
intended for reviewing pull-request changes. You must not use the Service as durable production hosting, a backend for
a live application, a content-delivery network, a file-sharing or storage service, a public API endpoint for
unrelated traffic, or any other "always-on" service. You must not deliberately keep previews alive (for example, by
generating synthetic activity or churning pull requests) to evade auto-stop and cleanup automation.

5.3 **No proxying, tunneling, or anonymization.** You must not operate an open proxy, VPN exit node, Tor relay/exit,
SOCKS proxy, traffic-tunneling service, or any mechanism that routes or relays third-party network traffic through a
preview environment.

5.4 **No attacks on third parties or the platform.** You must not launch, participate in, or facilitate from a preview
any denial-of-service (DoS/DDoS) attack, brute-force or credential-stuffing attack, reflection/amplification attack,
spam or abuse campaign, or any other attack against any system — including Shipyard's own infrastructure, other
tenants, GitHub, or unrelated third parties.

5.5 **No unauthorized scanning or reconnaissance.** You must not run network or port scanning, host discovery,
vulnerability scanning, or mass enumeration against systems you do not own or are not authorized to test, from within
a preview, a build step, or via our outbound network.

5.6 **No attempts to break isolation or escalate privileges.** You must not attempt to escape the container or
sandbox; access another tenant's data, environments, secrets, logs, or network namespace; access the host, the
control plane, the orchestration layer (Docker/Kubernetes), the metadata service, the job queue, or the database;
escalate privileges; or otherwise defeat the multi-tenant isolation boundary. Reporting such a weakness responsibly
is encouraged and addressed in Section 8 — exploiting it for any purpose beyond a single, minimal proof-of-concept on
your own tenant is not.

5.7 **No quota circumvention.** You must not evade, reset, or work around resource quotas, rate limits, concurrency
limits, time limits, egress limits, or billing measurement — for example by creating sham accounts or teams, rotating
API tokens to bypass throttling, spreading a single workload across many previews, or manipulating usage metering
(vCPU, memory, storage, egress) to under-report consumption.

5.8 **No excessive or anomalous resource consumption.** You must not consume compute, memory, storage, network
egress, or build minutes in a manner that is excessive relative to your plan, that materially degrades the Service for
others, or that is inconsistent with the legitimate purpose of previewing a code change. "Excessive" includes
sustained maxing-out of allocated resources, fork bombs, runaway processes, and unbounded log or artifact generation.
See Section 7 for the quantitative limits.

5.9 **No interference with build, deploy, or cleanup automation.** You must not tamper with Shipyard's build pipeline,
deploy engine, cleanup/auto-stop workers, cost-metering, logging, or webhook processing, except by using the
configuration options Shipyard exposes to you.

5.10 **Outbound network restrictions.** Shipyard may restrict, throttle, monitor, or block outbound network traffic
from previews and build steps to protect the platform and third parties. You must not attempt to circumvent these
controls.

> ⚠️ COUNSEL: Sections 5.1–5.10 describe operational controls Shipyard says it may apply (outbound restrictions,
> traffic monitoring, metering). Confirm these statements match what the platform actually does (see the engineering
> docs, Annex II to **see data-processing-addendum.md**, and any published security overview) and that any monitoring
> of outbound traffic is disclosed consistently in **see privacy-policy.md** and the DPA. Over-claiming controls that
> are not implemented creates misrepresentation exposure; under-disclosing monitoring that does occur creates privacy
> exposure.

---

## 6. Lawful data processing inside previews

6.1 **You are the controller for data inside your previews.** Personal data contained in your repositories, seed data,
databases, build artifacts, or preview runtime is processed by Shipyard **as a processor on your behalf**; you are the
controller. You must have a lawful basis to process that data and to have it processed by Shipyard, and you must
comply with all applicable data-protection laws, including the GDPR, UK GDPR, and the CCPA/CPRA and other US state
privacy laws, as applicable to you.

6.2 **No unlawful personal data in previews.** You must not load into a preview, seed dataset, or connected database
any personal data that you are not permitted to process or to disclose to the recipients of a preview URL. Be
especially careful with production personal data and with special-category / sensitive data.

> ⚠️ COUNSEL: Decide whether to **prohibit or strongly discourage** loading real production personal data or
> special-category data (GDPR Art. 9) / sensitive personal information (CPRA) into previews, and whether to require
> pseudonymization or synthetic seed data. Previews are shareable by URL and may be visible to external PR
> contributors — this is a meaningful re-identification and access-control risk. Align the chosen position with the
> DPA and `privacy-policy.md`. Note: GDPR-specific obligations and CCPA/CPRA-specific obligations differ; counsel
> should confirm the cross-references rather than treating "applicable data-protection law" as monolithic.

6.3 **Preview access controls.** You are responsible for who can access a preview URL and for using the access
controls Shipyard provides. Treat a preview URL as potentially accessible to anyone with the link unless you have
configured authentication on it.

> ⚠️ COUNSEL: Confirm what access controls actually exist for preview URLs (e.g., unguessable URL only, SSO, IP
> allow-listing, password protection). 6.3 should reflect the real capability set, not an aspirational one.

6.4 **Secrets.** You must use Shipyard's secrets mechanism for sensitive credentials rather than committing them to
source. Shipyard encrypts stored secrets at rest (AES-256-GCM) and does not return them in plaintext through the API
or UI; however, you remain responsible for the secrets you choose to store, for rotating compromised secrets, and for
not exposing secrets through your own application code, logs, or preview pages. Do not store secrets you are not
authorized to use, or that grant access to systems beyond the scope of the preview.

---

## 7. Resource, rate, and fair-use limits

7.1 **Limits apply.** Your use of the Service is subject to the resource and rate limits associated with your plan,
which may include limits on the matters below. Current limits are described in your plan and/or the documentation
referenced at `[[Plan/fees reference]]`.

| Limit                         | Applies to                                            | Default / plan value            |
| ----------------------------- | ----------------------------------------------------- | ------------------------------- |
| Concurrent preview environments | Active previews per team                            | [[Concurrent previews quota]]   |
| vCPU per preview / per team    | Compute allocation                                    | [[vCPU quota]]                  |
| Memory per preview / per team  | RAM allocation                                        | [[Memory quota]]                |
| Storage per preview / per team | Disk + artifacts                                      | [[Storage quota]]               |
| Network egress                 | Outbound data from previews                            | [[Egress quota]]                |
| Build minutes / build time     | Per build and aggregate                                | [[Build-minutes quota]]         |
| Preview lifetime / idle auto-stop | Time before idle previews are stopped/destroyed     | [[Auto-stop / TTL value]]       |
| API request rate               | Control-plane API and webhooks                         | [[API rate limit]]              |
| API tokens per team            | Active tokens                                          | [[API token quota]]            |

7.2 **Enforcement of limits.** Shipyard may meter (vCPU, memory, storage, egress), throttle, queue, pause, or stop
workloads that exceed applicable limits, and may bill for overage in accordance with `[[Plan/fees reference]]`. Auto-
stop and cleanup automation may terminate idle or expired previews without notice; this is normal operation, not a
penalty.

7.3 **Fair use.** Even within numeric limits, you must not use the Service in a way that is abusive, that degrades the
Service for others, or that is inconsistent with the purpose of previewing pull-request changes (see Section 5.8).

> ⚠️ COUNSEL: Decide whether the specific numeric quotas live in this AUP, in the Terms of Service, in the plan/order,
> or in external documentation, and how changes to them are made and communicated. Keeping hard numbers in an external
> `[[Plan/fees reference]]` (rather than this Policy) is usually easier to maintain, but the right to enforce/throttle/
> overbill must be clearly granted somewhere binding. Confirm overage billing is consistent with the Terms of Service.

---

## 8. Security research and responsible disclosure

8.1 **Responsible disclosure encouraged.** We welcome good-faith reports of security vulnerabilities affecting the
Service. If you discover a vulnerability — including a potential isolation, tenant-separation, or privilege-escalation
weakness (see Section 5.6) — please report it promptly to `[[Security contact email]]` and give us a reasonable time
to remediate before any public disclosure.

8.2 **Rules for good-faith testing.** Any security testing must:
- be limited to your own account, teams, repositories, and previews;
- avoid accessing, modifying, deleting, or exfiltrating data belonging to Shipyard or any other tenant;
- avoid privacy violations, service degradation, and disruption to other customers;
- use only the minimum proof-of-concept necessary to demonstrate the issue, and stop once it is demonstrated; and
- not include extortion, public disclosure before remediation, or use of the finding for any purpose other than the
  report.

8.3 **Out of scope.** Denial-of-service testing, physical attacks, social engineering of Shipyard staff or vendors
(including GitHub), spam, and automated high-volume scanning of the Service are not authorized.

> ⚠️ COUNSEL: Decide whether to offer a **safe harbor** — i.e., a binding commitment not to pursue legal action
> (under the agreement, anti-circumvention statutes such as the DMCA §1201, or computer-misuse/anti-hacking statutes
> such as the US CFAA or comparable foreign laws) against researchers who comply with Section 8.2. A safe harbor is
> increasingly expected, but its scope, conditions, and interaction with the Terms of Service must be drafted
> precisely, and it should be reconciled with the "no isolation-breaking" prohibition in Section 5.6 so the two do not
> contradict each other. Also decide whether a bug-bounty program (and any reward terms) is in or out of scope, and
> whether a separate `security-policy.md` / `SECURITY.md` should host the canonical disclosure terms with this Section
> cross-referencing it.

---

## 9. Responsibility for your end users and downstream customers

9.1 **You are accountable for everyone under your account.** You are responsible for the acts and omissions of your
team members, collaborators, API-token holders, external pull-request contributors whose code your configuration
allows to be built, and anyone you give access to a preview URL ("**your users**"), as if they were your own.

9.2 **Flow-down.** If you make the Service or any preview available to your own customers or to third parties, you must
ensure they are bound by terms at least as protective as this Policy, and you remain responsible for their compliance.

9.3 **Your own obligations to data subjects and end users.** You are responsible for providing any notices, obtaining
any consents, and honoring any rights (including data-subject rights under the GDPR/UK GDPR and consumer rights under
the CCPA/CPRA) owed to the individuals whose data appears in your previews. See the DPA (`data-processing-addendum.md`)
for how Shipyard assists you as a processor.

---

## 10. Enforcement

10.1 **Investigation.** We may investigate suspected violations of this Policy. This may include reviewing account and
usage metadata, build and runtime logs, and webhook/event records, and — to the extent necessary and lawful —
examining the operation of a preview. We will limit access to customer content to what is reasonably necessary to
investigate, secure the platform, and comply with law (consistent with the confidentiality and access commitments in
the Terms of Service (**see terms-of-service.md**), the DPA (**see data-processing-addendum.md**), and the technical
and organizational measures in Annex II to the DPA).

10.2 **Range of actions.** Depending on the nature and severity of a violation, and without limiting any remedy in the
Terms of Service (**see terms-of-service.md**), we may take one or more of the following actions, with or without prior
notice:
- issue a warning and request remediation, allowing a reasonable cure period where appropriate (see the Terms of
  Service for the contractual cure period applicable to termination for cause, `[[Cure period, e.g., 30 days]]`);
- throttle, queue, pause, or rate-limit your workloads;
- stop, quarantine, or destroy an offending Preview Environment, build, or artifact;
- disable a Customer Repository connection, API Token, or feature;
- take down specific content;
- suspend the affected Account, Team, or member (see the suspension right in the Terms of Service, Section 16.4); and/or
- terminate the Account or the Agreement in accordance with the Terms of Service (termination for cause, Section 16.3).

10.3 **Expedited action for security and active-harm threats.** For violations that present an imminent or active
threat — including attacks on third parties, attempts to break tenant isolation or escalate privileges (Section 5.6),
malware distribution, crypto-mining, CSAM, or conduct that is degrading the Service for others — we may act
**immediately and without prior notice**, including by suspending or isolating the offending workload, Account, or
Customer Repository connection, to contain the harm. This mirrors the emergency-action and suspension rights in the
Terms of Service (**see terms-of-service.md**, Sections 16.4–16.5). We will provide notice where reasonably
practicable and lawful after we have contained the threat.

10.4 **Proportionality and reinstatement.** We will aim to apply the least disruptive action reasonably sufficient to
address the violation, and to reinstate access once the violation is cured and the risk addressed, except where the
violation justifies termination under the Terms of Service. Because Preview Environments are ephemeral, "reinstatement"
may mean lifting a suspension or block so that you can redeploy, rather than restoring a previously destroyed Preview
Environment (see Section 3.3 of the Terms of Service).

10.5 **Cooperation with authorities and preservation.** We may report violations to, and cooperate with, law
enforcement or other authorities where required or permitted by law, and may preserve relevant records for that
purpose.

> ⚠️ COUNSEL: Confirm the enforcement actions and the with/without-notice standard here mirror the suspension and
> termination provisions in `terms-of-service.md` (avoid divergence between the two documents). Decide the standard for
> reporting to / cooperating with law enforcement and how that interacts with the DPA's "notify the controller before
> disclosing" obligations and any government-access transparency commitments. Confirm whether any service-credit, fee,
> or refund consequences attach to suspension/termination for AUP cause, and that this is consistent with the
> limitation-of-liability and SLA provisions (`[[Support/SLA terms]]`).

---

## 11. Reporting abuse

11.1 **How to report.** To report content or activity on the Service that you believe violates this Policy — including
abuse originating from a preview URL — email `[[Abuse email]]`. Please include the preview URL or account identifier
(if known), a description of the issue, and any evidence (such as timestamps or screenshots).

11.2 **Intellectual-property and other specialized notices.** Copyright/DMCA and other specialized legal notices may be
subject to a separate process and contact set out in the Terms of Service (see `terms-of-service.md`).

11.3 **Our response.** We will review reports and take action we consider appropriate under Section 10. We are not
obligated to disclose the outcome of any individual report.

> ⚠️ COUNSEL: Decide whether a single `[[Abuse email]]` suffices or whether separate intake addresses are needed for
> abuse, security (`[[Security contact email]]`), DMCA/IP, and law-enforcement requests, and whether any jurisdiction
> requires a designated agent (e.g., a US DMCA-registered agent, or an EU/UK representative under GDPR Art. 27 — see
> `privacy-policy.md`). Confirm response-time commitments, if any, are intentional.

---

## 12. Changes to this Policy

12.1 We may update this Policy from time to time — for example to address new abuse patterns specific to running
arbitrary code in previews, to reflect changes in law, or to clarify existing rules. When we make material changes, we
will update the effective date above and notify you by the method described in the Terms of Service. Your continued
use of the Service after the changes take effect constitutes acceptance of the updated Policy.

12.2 We may make immediate changes where necessary to address a security threat, legal requirement, or active abuse,
effective on posting.

> ⚠️ COUNSEL: Confirm the change/notice mechanism, the notice period for material changes, and whether changes are
> "continued use = acceptance" or require affirmative re-acceptance, consistent with `terms-of-service.md` and the
> consumer-protection rules of any relevant jurisdiction. Note EU/UK fairness rules on unilateral amendment clauses may
> differ from US norms; decide whether a consumer-law carve-out is needed if any non-business users could fall within
> scope.

---

## 13. Definitions

Capitalized terms used but not defined here have the meaning given in the Terms of Service (**see terms-of-service.md**).
For readability, this Policy also uses some lower-case shorthand (for example, "preview", "your code", "your
repositories", "team members"); each such term refers to the corresponding defined term in the Terms of Service
("Preview Environment", "Customer Code", "Customer Repository", "Authorized Users") and is used interchangeably with it.

- **"Preview" / "preview environment"** — a **Preview Environment** as defined in the Terms of Service: an isolated,
  ephemeral, full-stack environment that Shipyard builds and runs in containers (Docker / Kubernetes) for a given pull
  request or branch, together with its shareable preview URL.
- **"Build step" / "build"** — the process by which Shipyard clones a Customer Repository and builds the Customer Code
  to produce the images/artifacts used to run a Preview Environment (part of the Service described in
  **see terms-of-service.md**).
- **"Tenant isolation"** — the technical and operational boundary separating one customer's Preview Environments,
  Customer Content, Secrets, logs, and network from another's and from Shipyard's control plane; the authoritative
  technical and organizational measures are set out in Annex II to **see data-processing-addendum.md** (and in any
  published security overview, where available — see Section 1.3).
- **"Secrets"** — has the meaning given to "Environment Variables and Secrets" in the Terms of Service: configuration
  values, credentials, tokens, and other sensitive values you store in Shipyard for injection into Preview
  Environments; encrypted at rest with AES-256-GCM and never returned in plaintext via the API or UI.
- **"Quota" / "limit"** — a numeric or temporal restriction on resource consumption or request rate (see Section 7).
- **"Your users"** — the persons described in Section 9.1, comprising your Authorized Users and any other person who
  accesses the Service or a Preview Environment through your Account or connected repositories.

> ⚠️ COUNSEL: Reconcile every defined term here with the definitions in `terms-of-service.md`, the DPA, and
> `privacy-policy.md` so the same term is not defined two different ways across the document set.

---

*End of Acceptable Use Policy. Related documents: **see terms-of-service.md**, **see privacy-policy.md**,
**see data-processing-addendum.md**, **see subprocessors.md**, **see cookie-policy.md**, **see dmca-copyright-policy.md**,
and any published security overview (where available — see Section 1.3). Remember: this is a DRAFT template — every
`[[placeholder]]` must be completed and every `> ⚠️ COUNSEL:` callout resolved by [[Company Legal Name]]'s legal
counsel before publication or reliance.*
