> **DRAFT — FOR REVIEW BY [COMPANY]'s LEGAL COUNSEL. NOT LEGAL ADVICE.**
> This template was generated to give counsel a tailored starting point. It has NOT been reviewed by a lawyer.
> Do not publish or rely on it until your counsel has reviewed and adapted it for your jurisdiction(s) and business.
> Search this file for `[[ ]]` placeholders and `> ⚠️ COUNSEL:` callouts — each marks a decision counsel must make.

# Data Processing Addendum (DPA)

**This Data Processing Addendum forms part of, and is incorporated into, the [[Master Subscription Agreement / Terms of Service]] (the "Agreement") between [[Company Legal Name]] ("Shipyard", "Processor", "we") and the customer identified in the Agreement or applicable Order Form ("Customer", "Controller", "you").**

Shipyard operates a B2B SaaS preview-environments platform: for each GitHub pull request, Shipyard clones, builds, and **runs the Customer's application stack** in isolated, ephemeral containers (Docker / Kubernetes) and returns a shareable preview URL. In the course of providing that service, Shipyard processes Personal Data on Customer's behalf — in particular, Personal Data that may be contained in the Customer's source code, configuration, seed data, and preview databases. This DPA governs that processing.

This DPA does **not** govern Personal Data for which Shipyard is itself the controller (for example, account-administrator names and emails, GitHub login identity, billing contacts, and product telemetry tied to user/team IDs). That processing is described in **see privacy-policy.md**. Where the same individual appears in both contexts, the role split in **Section 3** controls.

| Field | Value |
| --- | --- |
| DPA effective date | [[Effective date]] |
| Governing agreement | [[Master Subscription Agreement / Terms of Service]] |
| Shipyard entity | [[Company Legal Name]], [[Jurisdiction of incorporation]] |
| Privacy / data-protection contact | [[Privacy/DPO contact]] |
| Security/breach notice channel | [[Breach notification email/endpoint]] |

> ⚠️ COUNSEL: Confirm how this DPA is executed and incorporated. Common options: (a) a click-through DPA referenced by the online Terms; (b) a signed exhibit to a negotiated MSA; (c) a standalone signed DPA. The execution method affects enforceability, the order-of-precedence clause (Section 17), and whether a wet/electronic signature block is needed. Decide and align Annex I "Parties" accordingly.

---

## Table of Contents

1. Definitions
2. Subject Matter, Duration, and Annexes
3. Roles of the Parties (Controller / Processor)
4. Scope and Details of Processing
5. Customer Instructions and Customer Warranties
6. Shipyard's Processing Obligations
7. Confidentiality of Personnel
8. Security of Processing
9. Subprocessors
10. Assistance with Data Subject Rights
11. Personal Data Breach Notification
12. Assistance with DPIAs and Prior Consultation
13. Deletion and Return of Personal Data
14. Audits and Information Rights
15. International Data Transfers
16. CCPA / CPRA Service-Provider Terms
17. Liability, Order of Precedence, and General
- Annex I — Description of Processing (Parties; Data Subjects; Data Categories; Operations; Duration)
- Annex II — Technical and Organisational Security Measures
- Annex III — List of Subprocessors

---

## 1. Definitions

1.1 Capitalised terms not defined in this DPA have the meaning given in the Agreement.

1.2 The following definitions are aligned to Article 4 GDPR (and read, where applicable, into the UK GDPR and other Data Protection Laws):

- **"Personal Data"** means any information relating to an identified or identifiable natural person ("Data Subject") that is Processed by Shipyard on Customer's behalf under the Agreement, as further described in Annex I.
- **"Processing"** (and "Process") means any operation performed on Personal Data, whether or not by automated means, such as collection, recording, organisation, structuring, storage, adaptation, retrieval, use, disclosure, transmission, restriction, erasure, or destruction.
- **"Controller"** means the entity that determines the purposes and means of the Processing of Personal Data. For the Personal Data covered by this DPA, the Controller is the Customer.
- **"Processor"** means the entity that Processes Personal Data on behalf of the Controller. For the Personal Data covered by this DPA, the Processor is Shipyard.
- **"Subprocessor"** means any third party engaged by Shipyard to Process Personal Data on Customer's behalf.
- **"Data Subject"** means the identified or identifiable natural person to whom Personal Data relates.
- **"Special Categories of Personal Data"** means the categories of data referred to in Article 9(1) GDPR (e.g. data revealing racial or ethnic origin, political opinions, religious beliefs, trade-union membership, genetic data, biometric data, health data, or data concerning a person's sex life or sexual orientation) and, where treated comparably under applicable law, data relating to criminal convictions and offences (Article 10 GDPR).
- **"Personal Data Breach"** means a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to, Personal Data Processed under this DPA.
- **"Data Protection Laws"** means all laws and regulations applicable to the Processing of Personal Data under the Agreement, including, as applicable: the EU General Data Protection Regulation (Regulation (EU) 2016/679) ("**GDPR**"); the GDPR as incorporated into UK law by the Data Protection Act 2018 and the European Union (Withdrawal) Act 2018 ("**UK GDPR**"); the Swiss Federal Act on Data Protection ("**FADP**"); and the California Consumer Privacy Act of 2018 as amended by the California Privacy Rights Act ("**CCPA/CPRA**"), together with any successor or comparable US state privacy laws.
- **"Standard Contractual Clauses"** or **"EU SCCs"** means the standard contractual clauses for the transfer of personal data to third countries adopted by the European Commission in Decision (EU) 2021/914 of 4 June 2021.
- **"UK IDTA"** means the International Data Transfer Agreement, and/or the UK International Data Transfer Addendum to the EU SCCs, issued by the UK Information Commissioner under section 119A of the Data Protection Act 2018.
- **"CCPA terms"** ("Business", "Service Provider", "Sell", "Share", "Business Purpose", "Commercial Purpose", "Consumer", "Personal Information") have the meanings given in the CCPA/CPRA.
- **"Customer Content"** means the source code, container images, configuration, environment variables and secrets, seed data, database contents, build artifacts, and logs that Customer (or its authorised users) submits to, or causes Shipyard to clone, build, run, or store in, the Shipyard service, including any Personal Data contained therein.

---

## 2. Subject Matter, Duration, and Annexes

2.1 **Subject matter.** The subject matter of the Processing is Shipyard's provision of the preview-environments service under the Agreement, including cloning Customer repositories, building and running Customer application stacks in ephemeral containers, applying seed data, storing encrypted secrets and configuration, and generating deployment, runtime, and usage logs.

2.2 **Duration.** This DPA applies for as long as Shipyard Processes Personal Data on Customer's behalf under the Agreement, and survives termination of the Agreement to the extent Shipyard retains any such Personal Data, until that Personal Data is deleted or returned in accordance with Section 13.

2.3 **Annexes.** The following Annexes form an integral part of this DPA:
- **Annex I** — Description of Processing (and the "Parties" detail required by the EU SCCs).
- **Annex II** — Technical and Organisational Security Measures (the "Security Annex").
- **Annex III** — List of Subprocessors (a pointer to **see subprocessors.md**).

---

## 3. Roles of the Parties

3.1 **Customer is Controller; Shipyard is Processor.** For the Personal Data described in Annex I, Customer is the Controller (or itself a processor acting on behalf of a third-party controller) and Shipyard is the Processor. Each party will comply with its respective obligations under Data Protection Laws.

3.2 **Customer as processor for third parties.** Where Customer is itself a processor of Personal Data on behalf of a third-party controller, Customer warrants that its instructions to Shipyard, and Customer's authorisation of the Processing under this DPA, are consistent with that third party's instructions, and that Customer has the authority to engage Shipyard as a subprocessor. Customer remains responsible as between the parties for the relationship with, and obligations to, any such third-party controller.

3.3 **Shipyard as Controller for other data.** This DPA does not apply to Personal Data for which Shipyard determines the purposes and means of Processing as a controller (e.g. account, authentication, billing, and product-telemetry data). That Processing is governed by **see privacy-policy.md**.

> ⚠️ COUNSEL: The account-administrator name/email and GitHub identity sit at a controller/processor boundary that auditors probe. The convention adopted here treats account/auth/billing/telemetry as Shipyard-as-controller (privacy-policy.md) and repository/seed/preview-database contents as Shipyard-as-processor (this DPA). Confirm this split is correct for the business and that the two documents do not contradict each other, especially regarding telemetry that is tied to user IDs but may also reflect activity within Customer projects.

---

## 4. Scope and Details of Processing

4.1 Shipyard will Process Personal Data only for the purposes of providing and supporting the service and as further specified in **Annex I** (categories of Data Subjects, categories of Personal Data, nature and purpose of Processing, and duration).

4.2 **Nature of the service — execution of Customer code.** Customer acknowledges that the service operates by **building and running Customer's own application code and stack** in containers. Any Personal Data that the Customer's application, configuration, or seed data introduces into a preview environment is determined by, and under the control of, the Customer. Shipyard does not select, inspect, or determine the content of Customer Content, and provides container-level isolation for that code as described in Annex II and in **see terms-of-service.md** / **see acceptable-use-policy.md**.

4.3 **Ephemeral previews.** Preview environments are short-lived by design. They are created on pull-request events and are stopped and destroyed automatically (on idle auto-stop, and on a destroy TTL after the pull request is closed or merged), as described in Section 13 and in the service documentation.

---

## 5. Customer Instructions and Customer Warranties

5.1 **Documented instructions.** Shipyard will Process Personal Data only on documented instructions from Customer, including with regard to international transfers, unless required to do so by EU/EEA, UK, or Member State law to which Shipyard is subject; in such a case, Shipyard will inform Customer of that legal requirement before Processing, unless that law prohibits such information on important grounds of public interest.

5.2 **What constitutes instructions.** Customer's complete and final instructions for the Processing are: (a) this DPA and the Agreement; (b) Customer's configuration and use of the service (including which repositories are connected, which secrets and seed data are loaded, and which environment settings are applied); and (c) any additional written instructions agreed by the parties. Shipyard will inform Customer if, in Shipyard's opinion, an instruction infringes Data Protection Laws (without obligation to provide legal advice).

5.3 **Lawful basis and notices/consents — Customer warranties.** Customer represents and warrants that, for all Personal Data it (or its users) submits to, or causes Shipyard to Process through, the service:
- (a) Customer has a valid legal basis under Data Protection Laws for the Processing and for engaging Shipyard as a Processor;
- (b) Customer has provided all required privacy notices to, and obtained all required consents or other lawful bases from, the relevant Data Subjects;
- (c) Customer's instructions and the Processing will not cause Shipyard to violate any Data Protection Law; and
- (d) Customer is solely responsible for the accuracy, quality, legality, and reliability of the Personal Data and for the means by which Customer acquired it.

5.4 **Production personal data in previews — strong caution.** Preview environments are **ephemeral, non-production** environments intended for reviewing changes before they are merged. Customer is **strongly cautioned not to load real production Personal Data** (including production database dumps or production-like seed data containing identifiable individuals) into preview environments. Where Customer requires representative data, Customer should use synthetic, anonymised, pseudonymised, or masked data. If Customer nevertheless chooses to introduce production or production-like Personal Data, Customer does so as Controller, on its own instructions and at its own risk, and the warranties in Section 5.3 apply in full.

> ⚠️ COUNSEL: This is a material risk for Shipyard. Decide how hard to push: (i) a non-binding caution (as drafted); (ii) a contractual prohibition on loading production Personal Data into previews; or (iii) a prohibition specifically on Special Categories / high-risk data. A flat prohibition is cleaner for liability but may be commercially unrealistic for some customers. Also decide whether breach of this clause should be an indemnified event and how it interacts with the AUP (see acceptable-use-policy.md) and the liability cap (Section 17). Note: seed templates are a first-class feature of Shipyard, so customers will be tempted to seed realistic data — calibrate accordingly.

5.5 **Special Categories.** Unless the parties have expressly agreed otherwise in writing (and implemented any additional safeguards required by Article 9 GDPR or applicable law), Customer will not submit, and will not configure the service to Process, Special Categories of Personal Data. The default position in Annex I is that no Special Categories are Processed.

> ⚠️ COUNSEL: Confirm whether Shipyard is willing to accept Special Categories at all. If yes, additional safeguards, an updated Annex I, and possibly heightened security measures and a separate risk assessment are required. If no, consider making Section 5.5 a firm prohibition rather than a default, and align Annex I.

5.6 **Customer's own compliance.** Customer is responsible, as Controller, for the lawfulness of the Processing it instructs, for responding to Data Subjects (with Shipyard's assistance per Section 10), and for any obligations that attach to it as Controller under Data Protection Laws.

---

## 6. Shipyard's Processing Obligations

6.1 Shipyard will:
- (a) Process Personal Data only on Customer's documented instructions (Section 5);
- (b) ensure that persons authorised to Process the Personal Data are subject to confidentiality obligations (Section 7);
- (c) implement and maintain the technical and organisational measures described in **Annex II** (Section 8);
- (d) respect the conditions in Section 9 for engaging Subprocessors;
- (e) assist Customer with Data Subject rights (Section 10), security, breach notification, DPIAs, and prior consultation (Sections 11–12), taking into account the nature of the Processing and the information available to Shipyard;
- (f) at Customer's choice, delete or return Personal Data on termination (Section 13); and
- (g) make available to Customer the information necessary to demonstrate compliance with Article 28 GDPR and allow for and contribute to audits (Section 14).

6.2 **No independent use.** Shipyard will not use Personal Data Processed under this DPA for its own purposes, will not Sell or Share it, and will not combine it with other data except as necessary to provide the service or as permitted by Section 16 and applicable law.

---

## 7. Confidentiality of Personnel

7.1 Shipyard will ensure that any person it authorises to Process the Personal Data (including employees and contractors) is bound by an appropriate obligation of confidentiality (whether contractual or statutory) and is informed of the confidential nature of the Personal Data.

7.2 Shipyard will limit access to Personal Data to those personnel who need access to perform their duties, consistent with the access controls described in Annex II.

---

## 8. Security of Processing

8.1 Taking into account the state of the art, the costs of implementation, and the nature, scope, context, and purposes of Processing, as well as the risks to Data Subjects, Shipyard will implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, as described in **Annex II**. These include, among others, encryption of secrets at rest (AES-256-GCM), encryption in transit, container-level isolation of Customer workloads, role-based access control, logging, and backup practices.

8.2 Shipyard may update its security measures from time to time, provided that any such update does not materially reduce the overall level of security of the service during the term.

8.3 Customer is responsible for the security configuration choices available to it within the service (for example, managing its team membership and roles, rotating its own API tokens and secrets, and not exposing preview URLs containing Personal Data more broadly than intended).

> ⚠️ COUNSEL: Section 8.3 allocates "shared responsibility." Confirm the boundary is accurate to the product (e.g. whether preview URLs are unauthenticated/shareable by default, and whether access controls on preview URLs are available). If preview URLs are guessable or public-by-default, that is a security-relevant fact that should be disclosed and addressed in Annex II and the AUP.

---

## 9. Subprocessors

9.1 **General authorisation.** Customer provides general written authorisation for Shipyard to engage Subprocessors to Process Personal Data, subject to this Section 9. The current Subprocessors are listed at **see subprocessors.md** (referenced in Annex III). GitHub is a core integration and Subprocessor of the service.

9.2 **Subprocessor obligations.** Shipyard will impose on each Subprocessor, by a written contract, data-protection obligations no less protective than those in this DPA (in particular the obligations under Article 28(3) GDPR as required by Article 28(4) GDPR), to the extent applicable to the services the Subprocessor provides. Shipyard remains liable to Customer for the performance of each Subprocessor's data-protection obligations as set out in Section 17. On Customer's reasonable written request, Shipyard will make available (subject to reasonable confidentiality protections and redaction of commercial or third-party-confidential terms) a copy of the relevant data-processing terms of the Subprocessor agreement, as contemplated by EU SCC Clause 9(c).

9.3 **Change notice.** Shipyard will notify Customer of any intended addition or replacement of a Subprocessor at least **[[Subprocessor change-notice period — e.g. 30 days]]** before that Subprocessor begins Processing Personal Data, by updating **see subprocessors.md** and/or by the notification method elected by Customer (for example, a subscription/RSS feed, email to **[[Notice email]]**, or in-product notice).

> ⚠️ COUNSEL: Decide the notice period (commonly 14–30 days) and the *mechanism* of notice. Note that the EU SCCs (Clause 9) require a minimum time-frame for objection — align the notice period with the SCC option chosen in Section 15. Also decide whether updating subprocessors.md alone is sufficient notice or whether an affirmative push (email/feed) to Customer is required; "update the page" alone is increasingly disfavoured by enterprise buyers and by the SCCs. The notice period and mechanism here MUST match the corresponding fields in **see subprocessors.md** Section 6, which currently leave them as placeholders.

9.3a **Emergency replacement.** Where Shipyard must replace a Subprocessor on an urgent basis (for example, because the existing Subprocessor suffers an outage, ceases operations, breaches its contract, or presents a security or legal risk such that continued use would jeopardise the security or continuity of the service), Shipyard may engage a replacement Subprocessor before completing the advance-notice period in Section 9.3, provided that Shipyard notifies Customer of the replacement (and the reason) as soon as reasonably practicable and that the objection right in Section 9.4 continues to apply on a post-notification basis.

> ⚠️ COUNSEL: Decide whether to permit emergency subprocessor replacement with concurrent (rather than advance) notice, as drafted in Section 9.3a. The sibling **see subprocessors.md** (Section 6) flags this same decision and warns it must be "defined consistently with data-processing-addendum.md"; if you adopt the carve-out, ensure the two documents describe it identically, and confirm it is compatible with the SCC Clause 9 option chosen in Section 15. If you reject the carve-out, delete Section 9.3a and remove the corresponding language in subprocessors.md so the two files do not conflict (this DPA controls under Section 17.2).

9.4 **Objection right.** Customer may object to a new or replacement Subprocessor on reasonable, documented data-protection grounds by notifying Shipyard within **[[objection window — e.g. the notice period above]]**. The parties will work in good faith to resolve the objection. If they cannot, Customer may, as its sole and exclusive remedy, terminate the affected service (or the Agreement to the extent the affected service is not severable) without penalty by giving written notice, in which case Section 13 (deletion/return) applies.

> ⚠️ COUNSEL: Confirm the objection remedy. Termination-without-penalty is standard. Consider whether a pro-rata refund of prepaid fees should be offered, and how this interacts with the SCCs' termination provisions.

---

## 10. Assistance with Data Subject Rights

10.1 Taking into account the nature of the Processing, Shipyard will assist Customer by appropriate technical and organisational measures, insofar as possible, to fulfil Customer's obligation to respond to requests from Data Subjects exercising their rights under Data Protection Laws (including rights of access, rectification, erasure, restriction, data portability, and objection).

10.2 Where Shipyard receives a request directly from a Data Subject relating to Personal Data Processed on Customer's behalf, Shipyard will not respond to the request itself (except to confirm that the request should be directed to Customer where permitted) and will, without undue delay, forward the request to Customer.

10.3 Because much of the Personal Data under this DPA resides inside Customer-controlled previews, source code, secrets, and seed data, Customer typically can locate, amend, export, and delete such data directly through the service or its own systems. Shipyard will provide reasonable assistance for data not directly accessible to Customer.

> ⚠️ COUNSEL: Decide whether assistance under Sections 10–12 is provided at no charge or whether Shipyard may charge reasonable, documented costs for assistance that goes beyond what is available via self-service tooling. The EU SCCs permit reasonable compensation; many DPAs cap or condition this. Align with [[Support/SLA terms]].

---

## 11. Personal Data Breach Notification

11.1 **Notice to Customer.** Shipyard will notify Customer without undue delay, and in any event within **[[breach notification window — e.g. 48 / 72 hours]]** after Shipyard becomes aware of a Personal Data Breach affecting Personal Data Processed on Customer's behalf.

> ⚠️ COUNSEL: Set the hours. GDPR Art. 33(2) requires processor-to-controller notice "without undue delay" but does not fix a number; the controller's own Art. 33(1) clock to the supervisory authority is 72 hours from *its* awareness, so processors commonly commit to 24, 48, or 72 hours. Note the EU SCCs require notice "without undue delay" — ensure the chosen number does not undercut the SCCs. Pick a number Shipyard can actually meet operationally given its on-call/detection posture, and align with the security incident process referenced in see incident-response / RUNBOOK.

11.2 **Contents of notice.** Shipyard's notice will, to the extent known and as it becomes available, describe: (a) the nature of the Personal Data Breach, including, where possible, the categories and approximate number of Data Subjects and records concerned; (b) the likely consequences; (c) the measures taken or proposed to address the breach and mitigate its effects; and (d) a contact point for more information. Shipyard may provide information in phases as the investigation progresses.

11.3 **Channel.** Shipyard will deliver breach notices to **[[Breach notification email/endpoint]]** (or the security/admin contact on file). Customer is responsible for keeping that contact current.

11.4 **Mitigation and cooperation.** Shipyard will take reasonable steps to investigate, contain, and mitigate the breach, and will cooperate with Customer and provide reasonable information to enable Customer to meet its own notification obligations to supervisory authorities and Data Subjects. Shipyard's notification is not, and will not be construed as, an acknowledgement of fault or liability.

---

## 12. Assistance with DPIAs and Prior Consultation

12.1 Taking into account the nature of the Processing and the information available to Shipyard, Shipyard will provide reasonable assistance to Customer with: (a) data protection impact assessments under Article 35 GDPR; and (b) prior consultation of a supervisory authority under Article 36 GDPR, in each case where such assessment or consultation relates to Customer's use of the service.

12.2 Annex II and **see security.md** [[if such a document exists]] are intended to provide information that supports Customer's DPIA process.

> ⚠️ COUNSEL: The sibling privacy-policy.md references a security summary as `security.md`; this DPA now uses the same file name for consistency. Confirm the final name of any published security overview/whitepaper and use it uniformly across all documents (privacy-policy.md, this DPA, and Section 14.2). Do not reference a security document that does not exist at publication; if there is no such document, delete the cross-reference rather than leave a dead pointer.

---

## 13. Deletion and Return of Personal Data

13.1 **Ephemeral previews.** Preview environments — including their running containers, preview databases, and applied seed data — are deleted automatically by the service in the ordinary course: idle previews are stopped after the configured auto-stop interval, and previews are destroyed after the configured destroy-TTL once the related pull request is closed or merged. As a result, Personal Data contained within a preview environment is short-lived by design.

13.2 **On termination.** Upon termination or expiry of the Agreement, Shipyard will, at Customer's choice, delete or return all Personal Data Processed on Customer's behalf, and delete existing copies, unless EU/EEA, UK, or Member State law (or other applicable law) requires storage of the Personal Data. Customer must make any election for return (and any export of Customer Content) before termination or within **[[post-termination return window — e.g. 30 days]]** after termination, after which Shipyard may delete the Personal Data.

13.3 **Persistent data.** Personal Data that persists beyond a single preview lifecycle — for example, encrypted secrets and environment variables, seed templates, and deployment/build/runtime logs retained for operational purposes — will be deleted in accordance with Section 13.2 and Shipyard's retention practices.

> ⚠️ COUNSEL: Set the post-termination return/deletion window and the operational data-retention periods (logs, cost/usage records, audit logs, backups). Confirm what "deletion" means for **backups** — point-in-time backups typically expire on a rolling schedule rather than being surgically purged; describe the rolling-expiry approach honestly here and in Annex II rather than promising immediate deletion from backups. Align all retention figures with [[Data retention period]] in the privacy-policy.md.

13.4 **Backups.** Where Personal Data remains in routine, secured backups after deletion from active systems, Shipyard will not actively Process that data other than as necessary for backup/restore integrity, and it will be deleted on expiry of the applicable backup cycle.

13.5 **Certification.** On Customer's reasonable written request, Shipyard will confirm in writing that it has complied with this Section 13.

---

## 14. Audits and Information Rights

14.1 Shipyard will make available to Customer all information reasonably necessary to demonstrate compliance with Article 28 GDPR and this DPA, and will allow for and contribute to audits, including inspections, conducted by Customer or an auditor mandated by Customer, in accordance with this Section 14.

14.2 **Means of demonstrating compliance.** Shipyard may satisfy its obligations under Section 14.1, in the first instance, by providing: (a) the Annex II security measures and **see security.md** [[if applicable]]; (b) responses to reasonable security questionnaires (no more than [[frequency — e.g. once per 12 months]] absent cause); and (c) any third-party audit reports or certifications Shipyard maintains [[if applicable — e.g. SOC 2 Type II, ISO/IEC 27001]].

> ⚠️ COUNSEL: Do NOT represent that Shipyard holds SOC 2, ISO 27001, or any certification unless and until it actually does. Keep these as "[[if applicable]]" until verified. If Shipyard intends to obtain a certification, decide whether to commit to a timeline. Misstating certification status is a misrepresentation risk and a deal-killer in due diligence.

14.3 **On-site / direct audits.** Where the documentation in Section 14.2 is insufficient to demonstrate compliance, or following a Personal Data Breach, Customer may conduct (or mandate an independent auditor to conduct) an audit, subject to: reasonable prior written notice (at least **[[audit notice period — e.g. 30 days]]**); conduct during business hours; no more than **[[audit frequency — e.g. once per 12 months]]** absent a Personal Data Breach or regulator requirement; reasonable confidentiality undertakings; and no access to other customers' data, Shipyard's proprietary or security-sensitive information beyond what is necessary, or any environment that would compromise the security or confidentiality of other customers.

14.4 **Costs.** Each party bears its own costs of an audit, except that Customer will reimburse Shipyard's reasonable costs for audits beyond the agreed frequency or where the audit reveals no material non-compliance, as the parties may agree.

> ⚠️ COUNSEL: Decide the audit cost allocation and frequency caps, and whether on-site audits are permitted at all for a multi-tenant SaaS (many vendors limit to documentation + questionnaire + third-party report, with on-site only after a breach). Ensure consistency with EU SCC Clause 8.9, which preserves the controller's audit right.

---

## 15. International Data Transfers

15.1 **Transfer mechanism.** To the extent that Shipyard's Processing involves a transfer of Personal Data subject to GDPR, UK GDPR, or the FADP to a country that does not benefit from an adequacy decision, the parties agree that an appropriate transfer mechanism will apply as set out in this Section 15.

15.2 **EU SCCs.** The EU SCCs are hereby incorporated by reference and apply to such transfers, completed as follows:
- **Module Two (Controller-to-Processor)** applies where Customer is a Controller and Shipyard is its Processor; **Module Three (Processor-to-Processor)** applies where Customer is itself a processor and Shipyard is its subprocessor.
- Clause 7 (docking clause): **[[include / omit]]**.
- Clause 9 (subprocessors): **Option 2 (general written authorisation)** with the notice period in Section 9.3.
- Clause 11 (independent dispute resolution / redress): the optional language is **[[included / not included]]**.
- Clause 17 (governing law): **[[EU Member State law — e.g. the law of Ireland]]**.
- Clause 18 (forum and jurisdiction): the courts of **[[EU Member State — e.g. Ireland]]**.
- Annexes I, II, and III of the SCCs are populated by **Annex I, Annex II, and Annex III of this DPA** respectively.

15.3 **UK transfers.** For transfers subject to the UK GDPR, the **UK IDTA** (or the UK Addendum to the EU SCCs) applies and is incorporated by reference, with the tables completed by reference to the Annexes of this DPA and the elections in Section 15.2, and with the UK Information Commissioner as the relevant supervisory authority.

15.4 **Swiss transfers.** For transfers subject to the FADP, the EU SCCs apply with the adjustments set out by the Swiss Federal Data Protection and Information Commissioner (including treating references to the GDPR as references to the FADP, recognising the FDPIC as a competent authority, and extending protections to legal entities where required).

15.5 **Supplementary measures.** The parties will cooperate to implement any supplementary measures required to ensure an essentially equivalent level of protection, taking into account the encryption and access controls described in Annex II.

15.6 **Adequacy / data-bridge.** Where the destination country benefits from an adequacy decision (or, for the US, where the recipient is certified under an applicable EU-US / UK extension / Swiss-US Data Privacy Framework), transfers may instead rely on that mechanism for so long as it remains valid.

> ⚠️ COUNSEL: This is one of the most important decisions in the DPA. Determine (a) where Shipyard and its Subprocessors actually host and Process data (GitHub, any cloud/host providers, the telemetry sink, PostHog if used) and which transfers occur; (b) which mechanism applies for each route (adequacy, Data Privacy Framework certification, EU SCCs, UK IDTA, Swiss adjustments); (c) the SCC module(s) and all bracketed elections in Section 15.2; and (d) whether a transfer impact assessment (TIA) is needed. If Shipyard or any Subprocessor relies on the EU-US Data Privacy Framework, verify current certification status — DPF status has been litigated and can change. Align hosting facts with subprocessors.md and Annex I.

---

## 16. CCPA / CPRA Service-Provider Terms

16.1 This Section 16 applies to Personal Information Shipyard Processes on Customer's behalf that is subject to the CCPA/CPRA. The parties intend Shipyard to act as a **Service Provider** to Customer (the **Business**).

16.2 **No sale, no sharing, no out-of-scope use.** Shipyard will not: (a) Sell or Share such Personal Information; (b) retain, use, or disclose it for any purpose other than the specific Business Purpose of providing the service under the Agreement, or as otherwise permitted by the CCPA/CPRA; (c) retain, use, or disclose it outside the direct business relationship between the parties; or (d) combine it with Personal Information received from, or on behalf of, other persons, except as permitted by the CCPA/CPRA (e.g. to perform a Business Purpose).

16.3 **Certification.** Shipyard certifies that it understands the restrictions in Section 16.2 and will comply with them.

16.4 **Cooperation.** Shipyard will reasonably assist Customer in responding to verifiable consumer requests under the CCPA/CPRA, consistent with Section 10, and will notify Customer if Shipyard determines it can no longer meet its Service-Provider obligations under this Section 16.

16.5 **Subcontractor flow-down.** Shipyard will engage any subcontractor (Subprocessor) that Processes such Personal Information only pursuant to a written contract that requires the subcontractor to observe the same restrictions and obligations as a Service Provider under the CCPA/CPRA, consistent with Section 9.

16.6 **Monitoring, stop, and remediation.** Customer may take reasonable and appropriate steps to ensure that Shipyard uses such Personal Information in a manner consistent with Customer's CCPA/CPRA obligations (consistent with Section 14), and, upon reasonable notice, the right to take reasonable and appropriate steps to stop and remediate any unauthorised use of Personal Information by Shipyard.

> ⚠️ COUNSEL: Confirm the Service-Provider (vs. Contractor) characterisation under CPRA and that the contract contains the mandatory CPRA flow-down terms. Add any other applicable US state-law processor terms (e.g. Virginia VCDPA, Colorado CPA, Texas TDPSA, and other state comprehensive privacy laws) as the customer base requires; several mandate specific processor-contract clauses (purpose limitation, confidentiality, subprocessor flow-down, assistance, audit, deletion).

---

## 17. Liability, Order of Precedence, and General

17.1 **Liability.** Each party's liability arising out of or related to this DPA, whether in contract, tort, or otherwise, is subject to the limitations and exclusions of liability set out in the Agreement, including the aggregate liability cap of **[[Liability cap]]**. Any reference in the Agreement to liability of a party means the aggregate liability of that party and all of its affiliates under the Agreement and this DPA together.

> ⚠️ COUNSEL: Confirm the DPA inherits (and does not separately stack on top of) the Agreement's liability cap, and decide whether data-protection claims should have a *super-cap* or be *carved out* from the general cap. Practice varies widely; enterprise customers often demand a higher cap (or uncapped liability) for breaches of confidentiality/data-protection obligations or for the indemnity. Note that liability under the EU SCCs themselves (Clause 12) runs to Data Subjects and cannot be limited as against them — your inter-party cap does not override that.

17.2 **Order of precedence.** In the event of a conflict between this DPA and the Agreement regarding the Processing of Personal Data, this DPA controls. In the event of a conflict between this DPA and the EU SCCs (or UK IDTA), the SCCs/IDTA control with respect to transfers governed by them.

17.3 **Governing law and forum.** Except where the EU SCCs, UK IDTA, or mandatory Data Protection Laws require otherwise (see Section 15), this DPA is governed by **[[Governing law]]**, with disputes subject to **[[Venue / dispute forum]]**, consistent with the Agreement.

> ⚠️ COUNSEL: Reconcile the Agreement's governing-law/forum clause with the SCC-mandated governing law and forum in Section 15.2 (which must be an EU Member State for Module Two/Three). These can differ legitimately — the SCCs govern transfers; the Agreement/DPA governs everything else — but the drafting must make the carve-out explicit to avoid an internal conflict.

17.4 **Severability and survival.** If any provision of this DPA is held invalid or unenforceable, the remainder remains in effect. The obligations in Sections 6, 7, 11, 13, and 16, and any provision that by its nature should survive, survive termination.

17.5 **Changes in law.** If a change in Data Protection Laws (or a regulatory or judicial decision) requires amendment of this DPA to keep the Processing lawful, the parties will negotiate in good faith to make the necessary changes.

17.6 **Entire agreement on Processing.** This DPA, together with its Annexes and the Agreement, constitutes the entire agreement of the parties regarding the Processing of Personal Data and supersedes any prior data-processing terms between them.

---

# Annex I — Description of Processing

> This Annex also serves as **Annex I to the EU SCCs** (Parts A "List of Parties", B "Description of Transfer", and C "Competent Supervisory Authority").

## A. List of Parties

**Data exporter (Controller): Customer.**
- Name: [[Customer legal name — from Order Form/Agreement]]
- Address: [[Customer address]]
- Contact: [[Customer data-protection contact / email]]
- Role: Controller (or processor acting for a third-party controller — see Section 3.2)

**Data importer (Processor): Shipyard.**
- Name: [[Company Legal Name]]
- Address: [[Company registered address]]
- Contact: [[Privacy/DPO contact]]
- Role: Processor
- Activities relevant to the data transferred: provision of the Shipyard preview-environments service (cloning, building, and running Customer application stacks in ephemeral containers; storing encrypted secrets and configuration; applying seed data; generating deployment, runtime, and usage logs; providing the dashboard, API, and support).

> ⚠️ COUNSEL: For the EU SCCs, the "List of Parties" must identify the actual signatories with addresses and a designated contact for each. Confirm whether an EU/UK Article 27 representative must be appointed and named here, and add any Shipyard affiliates that are parties.

## B. Description of the Processing / Transfer

**Categories of Data Subjects.** Depending on Customer Content and configuration, may include:
- Customer's authorised users and team members (e.g. developers, reviewers) whose identifiers appear in repository metadata, commits, pull requests, and logs;
- individuals whose Personal Data is contained in the Customer's source code, configuration, seed data, or preview databases (e.g. the Customer's own end users, customers, employees, or test personas);
- senders of pull-request and webhook events.

**Categories of Personal Data.** Depending on Customer Content and configuration, may include:
- identity and contact data (names, usernames, email addresses, GitHub logins);
- repository and development metadata (commit SHAs, branch names, pull-request data, authorship);
- any Personal Data embedded in source code, environment variables/secrets, seed data, and preview database contents as determined by Customer;
- deployment, build, and runtime logs that may incidentally contain Personal Data;
- usage and cost metrics tied to teams/users (vCPU, memory, storage, egress).

> ⚠️ COUNSEL: The category of "any Personal Data embedded in seed data / preview databases as determined by Customer" is intentionally open-ended because Shipyard does not control Customer Content. Confirm this is acceptable, or require Customer to specify/limit categories in the Order Form. Tighten in tandem with the Section 5.4 production-data position.

**Special Categories of Personal Data.** **[[Usually none.]]** By default, the parties agree that no Special Categories of Personal Data are Processed under this DPA (see Section 5.5). If, exceptionally, the parties agree that Special Categories may be Processed, list them here and the additional safeguards applied: [[ ]].

> ⚠️ COUNSEL: If the default ("none") is changed, Article 9 GDPR safeguards, an updated security assessment, and possibly a refusal/heightened-terms decision are required. Do not leave this blank-but-permissive.

**Frequency of the transfer/Processing.** Continuous, on an ongoing basis for the duration of the Agreement, triggered by Customer's use of the service and by pull-request/webhook events.

**Nature and purpose of the Processing.** Cloning, building, running, hosting, storing, transmitting, isolating, logging, and deleting Customer Content (including any Personal Data within it) for the sole purpose of providing, securing, maintaining, and supporting the preview-environments service in accordance with Customer's instructions and the Agreement.

**Duration of Processing / retention.** For the term of the Agreement and thereafter only as set out in Section 13 (ephemeral previews are deleted automatically on auto-stop and destroy-TTL; persistent data and logs are retained for **[[Data retention period]]** and then deleted; backups expire on a rolling cycle).

## C. Competent Supervisory Authority

The competent supervisory authority is **[[supervisory authority — e.g. determined per SCC Clause 13 / the lead authority based on Customer's EU establishment or its Art. 27 representative]]**; for UK transfers, the UK Information Commissioner's Office; for Swiss transfers, the FDPIC.

> ⚠️ COUNSEL: Identify the competent supervisory authority per EU SCC Clause 13 (based on the data exporter's establishment or its Article 27 representative). This depends on Customer facts and may differ per customer; consider a rule rather than a fixed authority.

---

# Annex II — Technical and Organisational Security Measures

> This Annex also serves as **Annex II to the EU SCCs**. It describes the measures Shipyard implements (taking into account Article 32 GDPR). Items marked **[[ ]]** or flagged by a COUNSEL callout are aspirational, conditional, or to-be-verified and must not be represented as in place until confirmed.

**1. Encryption.**
- Secrets and environment variables are encrypted at rest using **AES-256-GCM**; ciphertext only is stored in the database, and secret values are **never returned in plaintext** through the API or dashboard. Secret values are decrypted just-in-time for injection into preview containers.
- Data in transit is protected using **[[TLS version/policy — e.g. TLS 1.2+]]** for connections to the API, dashboard, and integrations.
- Encryption of the primary database / volumes at rest: **[[encrypted at rest via host/provider — confirm]]**.

> ⚠️ COUNSEL: Confirm TLS policy and whether the database and storage volumes are encrypted at rest by the hosting provider. AES-256-GCM for secrets is a verified product fact (per ARCHITECTURE.md); broader at-rest encryption must be verified before stating it.

**2. Isolation of Customer workloads (execution of untrusted code).**
- Each preview runs the Customer's own application stack in **isolated containers** (Docker / Kubernetes), created per pull request and destroyed after use.
- Network, compute, and storage isolation between preview environments and between customers: **[[describe actual isolation boundaries — e.g. per-tenant namespaces/networks, resource quotas, syscall/seccomp restrictions, rootless or sandboxed runtimes]]**.

> ⚠️ COUNSEL: Because previews **execute the Customer's arbitrary, potentially untrusted code**, the strength and configuration of container isolation is the single most security-sensitive item in this Annex and the most likely to be probed in diligence and after any incident. State only the isolation controls that are actually implemented (per the deploy-engine), and avoid overstating multi-tenant separation. Cross-reference the resource-abuse / crypto-mining / DoS prohibitions in see acceptable-use-policy.md and the responsibility allocation in see terms-of-service.md.

**3. Access control and authentication.**
- Authentication via **GitHub OAuth** (dashboard) and session cookies or scoped **API tokens** (CLI/API).
- **Role-based access control (RBAC)** with team roles (Owner / Admin / Member / Viewer) enforced at the API.
- Least-privilege access to production systems and Personal Data for Shipyard personnel; **[[MFA on administrative access, SSO for internal tooling — confirm]]**.

> ⚠️ COUNSEL: Confirm internal administrative access controls (MFA, SSO, privileged-access management, key custody for SECRETS_ENCRYPTION_KEY). The custody and rotation of the master secrets-encryption key is a critical control and should be described accurately (where the key lives, who can access it, rotation policy).

**4. Logging and monitoring.**
- Structured application logging (pino) and persisted deployment/build/runtime logs; webhook idempotency and audit logging of significant actions (AuditLog).
- Security monitoring / alerting: **[[describe monitoring, log retention, and alerting — confirm]]**.

> ⚠️ COUNSEL: Confirm security monitoring/alerting and log retention periods, and ensure logs that may contain Personal Data are themselves access-controlled and retained no longer than necessary (align with Section 13 and the privacy-policy.md retention period).

**5. Resilience and backups.**
- PostgreSQL is the primary datastore; backups: **[[backup schedule, encryption, retention, and restore testing — confirm]]**.
- Availability / SLA: **[[Support/SLA terms]]**.

> ⚠️ COUNSEL: Confirm backup schedule, encryption, retention, and whether restores are tested. Reconcile backup retention with the deletion obligations in Section 13.4.

**6. Vulnerability and patch management; secure development.**
- **[[Dependency scanning, vulnerability management, patch cadence, code review, CI checks — confirm.]]**
- **[[Penetration testing cadence — confirm; if external pen tests are performed, state frequency.]]**

> ⚠️ COUNSEL: Populate the SDLC/vuln-management measures with what Shipyard actually does. Do not claim a pen-test cadence or certification that is not in place.

**7. Personnel and organisational measures.**
- Confidentiality obligations for personnel (Section 7); **[[security training; background checks where lawful — confirm]]**.
- Subprocessor management per Section 9 and **see subprocessors.md**.

**8. Data minimisation and deletion.**
- Ephemeral previews auto-stop and auto-destroy (Section 13.1); secrets stored as ciphertext only; deletion/return on termination (Section 13).

**9. Incident response.**
- Personal Data Breach notification per Section 11; internal incident-response process: **[[reference to internal IR runbook — see RUNBOOK.md / incident-response process]]**.

> ⚠️ COUNSEL: Ensure the breach-notification commitment in Section 11 is operationally supported by the IR process referenced here (detection, on-call, escalation, customer-notification owner). A contractual hours commitment Shipyard cannot detect-and-meet is a liability.

---

# Annex III — List of Subprocessors

The current list of Subprocessors authorised under Section 9, including each Subprocessor's name, the Processing activity, and the location/region of Processing, is maintained at **see subprocessors.md** and is incorporated into this DPA by reference. **GitHub** is a core Subprocessor.

Changes to the Subprocessor list are governed by Section 9 (general authorisation, change notice, and objection right).

> ⚠️ COUNSEL: Ensure subprocessors.md is complete and accurate (name, role/activity, location, and transfer mechanism for each), covers all hosting/cloud providers, the configurable telemetry sink (and PostHog where used), email/notification providers, and support tooling — and that it is kept in sync with the international-transfers analysis in Section 15 and the parties/locations in Annex I. The EU SCCs require the subprocessor list to form part of Annex III to the SCCs; confirm the pointer-by-reference approach is acceptable to your enterprise customers, or inline the list at execution.
