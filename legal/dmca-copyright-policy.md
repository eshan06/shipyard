> **DRAFT — FOR REVIEW BY [COMPANY]'s LEGAL COUNSEL. NOT LEGAL ADVICE.**
> This template was generated to give counsel a tailored starting point. It has NOT been reviewed by a lawyer.
> Do not publish or rely on it until your counsel has reviewed and adapted it for your jurisdiction(s) and business.
> Search this file for `[[ ]]` placeholders and `> ⚠️ COUNSEL:` callouts — each marks a decision counsel must make.

# Shipyard — Copyright / DMCA Policy

**Operated by:** [[Company Legal Name]] ("**Shipyard**", "**we**", "**us**", "**our**")
**Effective date:** [[Effective date]]
**Last updated:** [[Effective date]]

This Copyright / DMCA Policy ("**Policy**") explains how [[Company Legal Name]] responds to claims of copyright infringement concerning the Shipyard service ("**Service**"). It is part of, and incorporated by reference into, our Terms of Service (see `terms-of-service.md`) and Acceptable Use Policy (see `acceptable-use-policy.md`). Capitalized terms not defined here have the meaning given in the Terms of Service.

> ⚠️ COUNSEL: Confirm the safe-harbor framework you are actually relying on. This template is drafted primarily around the U.S. Digital Millennium Copyright Act ("DMCA"), 17 U.S.C. § 512. Eligibility for the § 512(c) safe harbor for "Information Residing on Systems or Networks at Direction of Users" requires (a) designation and registration of an agent with the U.S. Copyright Office, (b) adoption and reasonable implementation of a repeat-infringer termination policy, and (c) accommodation of standard technical measures. Decide whether Shipyard should also claim § 512(a) (conduit), § 512(b) (caching), or § 512(d) (information location tools) protections given how previews are built, cached, and served. The classification matters because the notice-and-takedown obligations differ by subsection.

---

## Table of Contents

1. [Why this Policy exists — how Shipyard handles your content](#1-why-this-policy-exists--how-shipyard-handles-your-content)
2. [Our commitment to intellectual property](#2-our-commitment-to-intellectual-property)
3. [Who is responsible for content in previews](#3-who-is-responsible-for-content-in-previews)
4. [The ephemeral nature of previews — read this first](#4-the-ephemeral-nature-of-previews--read-this-first)
5. [How to submit a DMCA takedown notice](#5-how-to-submit-a-dmca-takedown-notice)
6. [Designated DMCA Agent](#6-designated-dmca-agent)
7. [What we do when we receive a valid notice](#7-what-we-do-when-we-receive-a-valid-notice)
8. [Counter-notification process](#8-counter-notification-process)
9. [Repeat-infringer policy and account termination](#9-repeat-infringer-policy-and-account-termination)
10. [Good-faith requirement and misrepresentation liability](#10-good-faith-requirement-and-misrepresentation-liability)
11. [Non-U.S. notices (EU/UK and other jurisdictions)](#11-non-us-notices-euuk-and-other-jurisdictions)
12. [Trademark and other (non-copyright) complaints](#12-trademark-and-other-non-copyright-complaints)
13. [How we handle your notice data (privacy)](#13-how-we-handle-your-notice-data-privacy)
14. [Changes to this Policy](#14-changes-to-this-policy)
15. [Contact](#15-contact)

---

## 1. Why this Policy exists — how Shipyard handles your content

Shipyard is a preview-environments manager. For each GitHub pull request that a customer connects, Shipyard clones the customer's repository, builds the customer's application, and **runs that application in isolated, ephemeral containers** (Docker / Kubernetes), then returns a shareable preview URL. As a result, Shipyard:

- **stores** customer-provided source code, build artifacts, environment variables, and configuration;
- **executes** customer-provided code to produce a running preview; and
- **serves** content from previews at URLs that may be shared with third parties.

Because Shipyard hosts and serves material supplied by its users, third parties may believe that material infringes their copyrights. This Policy is the channel for those claims and describes how we respond.

> ⚠️ COUNSEL: Decide whether preview URLs are, by default, public/unauthenticated or access-controlled. The breadth of "publicly accessible at the direction of a user" affects both the safe-harbor analysis and the practical infringement exposure. If preview URLs are unauthenticated and indexable, the takedown exposure is materially higher; cross-check the access-control description here against `security.md` and the Terms of Service.

## 2. Our commitment to intellectual property

We respect the intellectual property rights of others and expect Shipyard customers, their team members, and their end users to do the same. As stated in the Acceptable Use Policy (see `acceptable-use-policy.md`), you may not use the Service to store, build, execute, host, or distribute material that infringes the copyright, trademark, patent, trade-secret, publicity, privacy, or other rights of any party.

In appropriate circumstances and in our discretion, we will disable or terminate access for users who infringe or repeatedly infringe the intellectual property rights of others, as described in Section 9.

## 3. Who is responsible for content in previews

**The customer is responsible for the code and content it brings to Shipyard.** As set out in the Terms of Service and Acceptable Use Policy:

- The customer represents that it owns, or has all necessary rights and licenses to, the source code, dependencies, assets, seed data, and other materials it uploads, connects, builds, or runs through the Service.
- Shipyard does not author, select, review, endorse, or pre-screen customer code or the output of previews. Previews run **arbitrary, customer-supplied code** at the customer's direction.
- Shipyard processes personal data contained in customer repositories, seed data, and databases **on the customer's behalf as a processor** (see `data-processing-addendum.md`); copyright responsibility for that material likewise rests with the customer as the party that supplied it.

Shipyard's role under this Policy is limited to that of a host/intermediary responding to infringement claims in the manner described below.

> ⚠️ COUNSEL: Ensure the allocation of responsibility and the user representations/warranties and IP indemnity in `terms-of-service.md` are consistent with this section (e.g., a customer indemnity for third-party IP claims arising from customer code/content). This Policy should not be the only place those obligations live.

## 4. The ephemeral nature of previews — read this first

**Preview environments are ephemeral and short-lived by design.** Shipyard creates a preview when a pull request is opened or updated and **automatically tears it down** when the pull request is merged or closed, after a period of inactivity, or upon other lifecycle events configured by the customer or by Shipyard.

This has practical consequences for copyright complaints:

1. **The material you are reporting may already be gone.** By the time a notice reaches us, the specific preview URL may have expired and its containers, build artifacts, and runtime may have been destroyed in the ordinary course. In that case there may be nothing for us to "take down" at that URL.
2. **The same material may reappear** at a new preview URL if the customer pushes new commits to the underlying pull request or repository. A single takedown of one preview URL does not remove the material from the customer's source repository, which **Shipyard does not control** — the canonical source typically lives on GitHub or another version-control host (see `subprocessors.md`).
3. **To address recurring material at its source,** the rights holder may also need to contact the relevant repository host (for example, GitHub) and/or the customer directly. Shipyard can act on the copies it stores or serves; it cannot remove material from systems operated by others.

To help us act effectively despite this, please **report promptly** and identify the material as precisely as you can (see Section 5). Where the offending material recurs across multiple regenerated previews, say so in your notice; we will consider proportionate measures, which may include suspending preview generation for the affected project pending resolution.

> ⚠️ COUNSEL: Confirm what records Shipyard retains after a preview is torn down (e.g., build logs, deployment logs, cached layers, source clones). The interaction between (a) the duty to act "expeditiously" under § 512(c), (b) automatic ephemeral deletion, and (c) any litigation-hold or preservation duties once a notice is received should be reconciled. Decide and document whether receipt of a takedown notice triggers a hold that overrides automatic deletion. Align retention statements with `privacy-policy.md` and `data-processing-addendum.md`.

## 5. How to submit a DMCA takedown notice

If you are a copyright owner, or authorized to act on behalf of one, and you believe material accessible through the Service infringes your copyright, you may send a written notification to our Designated DMCA Agent (Section 6).

To be effective under 17 U.S.C. § 512(c)(3), your notice **must include substantially all** of the following:

1. **A physical or electronic signature** of a person authorized to act on behalf of the owner of the exclusive right that is allegedly infringed.
2. **Identification of the copyrighted work** claimed to have been infringed, or, if multiple works are covered by a single notification, a representative list of such works.
3. **Identification of the material that is claimed to be infringing** or to be the subject of infringing activity, and that is to be removed or access to which is to be disabled, with **information reasonably sufficient to permit us to locate the material** — for Shipyard this means, wherever possible:
   - the exact **preview URL(s)** at issue;
   - the connected **repository** and, if known, the **pull-request number**, **branch name**, and/or **commit SHA**; and
   - the **specific file path(s)** or page(s) within the preview where the material appears.
4. **Information reasonably sufficient to permit us to contact you**, such as your name, mailing address, telephone number, and email address.
5. **A statement that you have a good-faith belief** that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.
6. **A statement that the information in the notification is accurate**, and **under penalty of perjury, that you are authorized** to act on behalf of the owner of the exclusive right that is allegedly infringed.

**Incomplete notices.** Under § 512(c)(3)(B), a notice that fails to comply substantially with items 2, 3, and 4 above does not constitute actual knowledge or awareness for safe-harbor purposes. Note that, under § 512(c)(3)(B)(ii), this "no knowledge" treatment depends on us **promptly attempting to contact** the complainant, or taking other reasonable steps to obtain a compliant notice, where the notice substantially satisfies items 2, 3, and 4 but is otherwise deficient. If your notice is materially deficient, we may disregard it or attempt to contact you to obtain a compliant notice.

> ⚠️ COUNSEL: Confirm operations actually implement the § 512(c)(3)(B)(ii) "prompt attempt to contact" step where a notice is partially compliant, since the protective "no knowledge" treatment of a deficient notice can be lost if that step is skipped. Decide the standard wording/turnaround for deficiency outreach.

> ⚠️ COUNSEL: Decide whether to publish a web form, a dedicated intake email, or both, and whether to require notices in English. Also decide on internal SLAs for "expeditious" action and triage. Consider whether to log notices for the repeat-infringer tally (Section 9) at intake.

## 6. Designated DMCA Agent

Notices under this Policy must be sent to our **Designated DMCA Agent**:

- **Agent name / title:** [[Designated DMCA agent — name/title]]
- **Email:** [[Designated DMCA agent email]]
- **Mailing address:** [[Designated DMCA agent mailing address]]
- **Phone:** [[Designated DMCA agent phone]]

> ⚠️ COUNSEL: The Designated Agent **must be registered with the U.S. Copyright Office** through its online DMCA Designated Agent Directory (https://dmca.copyright.gov), and that registration must be **renewed every three years** to maintain § 512(c) safe-harbor eligibility. Under § 512(c)(2), the agent's contact information must **also be made available to the public on the provider's website** (in addition to the Copyright Office filing); confirm this Policy (and/or a footer/legal page on the Shipyard site) actually publishes these details and that they match the registered designation exactly. Decide whether the agent is an individual employee, a role-based mailbox, or a third-party agent service, and assign an owner for the renewal calendar. Confirm whether you want a separate non-U.S. point of contact (see Section 11).

> ⚠️ COUNSEL: This address/inbox is for **copyright/DMCA notices only**. Confirm separate routing for trademark complaints (Section 12), abuse reports (see `acceptable-use-policy.md`), privacy/data-subject requests (see `privacy-policy.md`), and general legal notices (`[[Notice email]]`) so that DMCA traffic does not get lost and non-DMCA matters are not mishandled.

## 7. What we do when we receive a valid notice

When we receive a notice that substantially complies with Section 5, we will, in line with § 512(c):

1. **Act expeditiously** to remove or disable access to the identified material that is within our control — for example, by taking down or disabling the affected preview URL, stopping the affected preview container, and/or restricting regeneration of the affected preview where appropriate.
2. **Take reasonable steps to notify the affected customer/user** that we have removed or disabled access to the material, and provide them with a copy of the notice (which may include your contact information) so that they may submit a counter-notification under Section 8.
3. Where the material has **already been removed by the ordinary ephemeral lifecycle** (Section 4), confirm that status to the complainant and, if relevant, note that recurrence may require action at the source repository or directly with the customer.

We may, but are not obligated to, take additional proportionate measures where infringing material recurs across regenerated previews, including temporarily suspending preview generation for the affected project pending resolution. Nothing in this Section requires us to monitor the Service, to actively seek facts indicating infringing activity, or to access, decrypt, or inspect customer **secrets** (which are encrypted at rest with AES-256-GCM and are never returned in plaintext through the API or UI).

**We do not adjudicate the merits.** We are not a court and do not decide whether material is in fact infringing or whether a defense such as fair use applies. We act on the basis of facially valid notices and counter-notifications, and we are not obligated to access, decrypt, build, run, or otherwise inspect customer source code, build artifacts, or running previews in order to verify a complaint before acting. Where we cannot locate the material from the information you provide (Section 5), we may ask you for more detail or decline to act.

> ⚠️ COUNSEL: Confirm that acting on "facially valid" notices without independently verifying the merits is consistent with the chosen safe-harbor posture and with the warranty/disclaimer and limitation-of-liability clauses in `terms-of-service.md`. Also confirm operationally how staff locate reported material in a preview without breaking tenant isolation or inspecting customer secrets/code beyond what is necessary (cross-check `security.md` and the DPA's technical-and-organizational-measures section, since secrets are decrypted in memory at runtime).

> ⚠️ COUNSEL: Decide on Shipyard's forwarding practice and how it intersects with privacy law. Forwarding a complainant's contact details to an accused customer is contemplated by § 512(g)(2), but where the complainant is an individual in the EU/UK, GDPR/UK GDPR transparency and data-minimization principles apply (see `privacy-policy.md`). Consider redacting personal contact details before forwarding, while preserving enough for the counter-notification exchange.

## 8. Counter-notification process

If you are a Shipyard customer or user and you believe that material of yours was removed or disabled as a result of mistake or misidentification, you may submit a **counter-notification** to our Designated DMCA Agent (Section 6).

To be effective under 17 U.S.C. § 512(g)(3), your counter-notification **must include substantially all** of the following:

1. **Your physical or electronic signature.**
2. **Identification of the material** that has been removed or to which access has been disabled, and **the location at which the material appeared before it was removed or disabled** (for Shipyard, the relevant preview URL(s), repository, pull-request number, branch, and/or commit SHA, to the extent known).
3. **A statement under penalty of perjury** that you have a good-faith belief that the material was removed or disabled as a result of mistake or misidentification of the material.
4. **Your name, address, and telephone number**, and **a statement that you consent to the jurisdiction** of the Federal District Court for the judicial district in which your address is located, or, if your address is outside the United States, for any judicial district in which [[Company Legal Name]] may be found, and **that you will accept service of process** from the person who provided the original notification or that person's agent.

**What happens next.** Upon receipt of a compliant counter-notification, we will promptly provide the original complainant with a copy and inform them that we will **restore or cease disabling access to the removed material in not less than 10 and not more than 14 business days**, unless our Designated DMCA Agent first receives notice from the complainant that they have filed an action seeking a court order to restrain the allegedly infringing activity.

> ⚠️ COUNSEL: The "10–14 business day" restoration window comes from § 512(g)(2)(C). Confirm you want to recite the statutory window verbatim and that operations can honor it. **Important Shipyard-specific issue:** because previews are ephemeral, the literal "restoration" of the original preview may be impossible — the container/URL may no longer exist by the time the window elapses. Decide how to operationalize "restore" here (e.g., lift any suspension on preview generation for the affected project / allow the customer to redeploy), and describe that accurately rather than promising restoration of a destroyed artifact.

## 9. Repeat-infringer policy and account termination

Consistent with 17 U.S.C. § 512(i), [[Company Legal Name]] has adopted and will reasonably implement a policy providing for the **termination, in appropriate circumstances, of accounts of customers and users who are repeat infringers.**

- We maintain a record of takedown notices we act upon and associate them with the relevant account.
- An account that accumulates **[[repeat-infringer strike threshold, e.g., three]]** substantiated infringement incidents within **[[lookback period, e.g., twelve months]]**, or that engages in egregious or willful infringement, may have its access **suspended or terminated**, and connected GitHub installations and preview generation disabled.
- We may also terminate or suspend accounts in other circumstances at our discretion, as described in the Terms of Service (see `terms-of-service.md`).

Counter-notifications that result in restoration, and notices later withdrawn or found to be invalid, are generally not counted toward the repeat-infringer threshold.

> ⚠️ COUNSEL: The DMCA deliberately leaves "repeat infringer" and "appropriate circumstances" undefined; courts have found loss of safe harbor where a policy existed only on paper. Decide the concrete strike threshold, lookback window, and the human decision-maker, and ensure the process is actually executed and logged. Decide whether counter-noticed/withdrawn notices count, and whether to weight willful vs. inadvertent conduct. This section must reflect a real, enforced internal procedure, not aspiration.

## 10. Good-faith requirement and misrepresentation liability

Both takedown notices and counter-notifications carry legal consequences for false statements.

- Under **17 U.S.C. § 512(f)**, any person who **knowingly materially misrepresents** that material is infringing, or that material was removed or disabled by mistake or misidentification, **may be liable for damages**, including costs and attorneys' fees, incurred by the alleged infringer, by any copyright owner or its licensee, or by us, as a result of our reliance on the misrepresentation.
- Submitting a notice or counter-notification also requires statements made **under penalty of perjury** (Sections 5 and 8).
- Please consider whether the use you are reporting may be authorized by license or permitted by law (for example, **fair use** under U.S. law). If you are unsure whether material is infringing, you should consult an attorney before submitting a notice.

We reserve the right to seek any remedies available to us for bad-faith, abusive, or fraudulent notices, including ignoring or rejecting notices from senders who repeatedly submit invalid or abusive complaints.

## 11. Non-U.S. notices (EU/UK and other jurisdictions)

The DMCA is a U.S. statute. Rights holders and users outside the United States may have rights and remedies under other regimes, and different notice-and-action procedures may apply to material processed or accessed in those jurisdictions:

- **European Union — Digital Services Act (DSA), Regulation (EU) 2022/2065.** The DSA establishes a **notice-and-action** mechanism (Article 16) for hosting services, statements of reasons to affected users (Article 17), and complaint-handling/redress requirements. A DSA notice has its own required elements (sufficiently substantiated explanation of why the content is illegal, location/URL, the notifier's identity where required, and a good-faith statement).
- **United Kingdom.** Hosting intermediaries may rely on liability protections derived from the e-Commerce regime as retained/amended in UK law; takedown is generally triggered by **actual knowledge** of unlawful material.
- **Other jurisdictions** may impose their own notice, counter-notice, retention, or local-representative requirements.

If you are outside the United States, you may still use the contact in Section 6, and we will handle your complaint under the framework applicable to the material and your jurisdiction. Where required, complaints concerning content in the EU/UK may be directed to a separate point of contact: [[EU/UK content / legal point of contact — if applicable]].

> ⚠️ COUNSEL: This is a significant scoping decision. Determine which non-U.S. regimes actually apply to Shipyard based on where it is established, where it offers the Service, and user/recipient locations. The DSA imposes obligations beyond takedown — e.g., a published **single point of contact** for authorities and recipients, possible **legal-representative** designation for providers without an EU establishment, statements of reasons, internal complaint-handling, and (for "online platforms") trusted-flagger and transparency-reporting duties; many small/micro enterprises are exempt from some platform-specific duties, but the hosting-level notice-and-action and statement-of-reasons rules still merit analysis. Decide whether Shipyard is in scope and whether a separate `dsa-notice.md` / EU contact is warranted. Cross-reference `privacy-policy.md` for the EU/UK GDPR overlay on processing notifier and customer personal data.

## 12. Trademark and other (non-copyright) complaints

This Policy covers **copyright** claims only. If your complaint concerns trademarks, trade secrets, defamation, privacy or publicity rights, malware, abuse of compute resources (for example, crypto-mining or denial-of-service launched from a preview), or other violations, please use the abuse and reporting channels described in the Acceptable Use Policy (see `acceptable-use-policy.md`) or contact us at [[Notice email]]. Misuse of the DMCA process for non-copyright disputes may delay or invalidate your complaint.

## 13. How we handle your notice data (privacy)

When you send us a takedown notice or a counter-notification, you give us personal data — for example your name, mailing address, telephone number, and email address, plus the contents of your complaint. **For the personal data contained in these notices and in our records of them, [[Company Legal Name]] acts as a _controller_** (not as a processor on a customer's behalf). This is different from how Shipyard processes personal data inside customer previews, where Shipyard generally acts as a _processor_ on the customer's behalf (see Section 3 and `data-processing-addendum.md`).

We use this notice data to: (a) evaluate and respond to your complaint; (b) carry out the notice-and-takedown and counter-notification exchange (which, as Sections 7 and 8 explain, includes **forwarding the notice — potentially including your identity and contact details — to the affected customer/user**, and forwarding a counter-notification to the original complainant); (c) maintain our repeat-infringer records (Section 9); and (d) comply with our legal obligations and establish, exercise, or defend legal claims. We retain notices, counter-notifications, and related records for **[[Notice/takedown record retention period]]** (which may exceed the lifetime of the affected preview, including for repeat-infringer tracking and litigation-preservation purposes — see Section 4).

How we handle this data, the legal bases on which we rely, your rights, and international transfers are described in our Privacy Policy (see `privacy-policy.md`).

> ⚠️ COUNSEL: Confirm the controller framing above and the retention period, and reconcile them with `privacy-policy.md` and the litigation-hold point in Section 4. Under GDPR/UK GDPR, identify the **lawful basis** for processing notifier and accused-user personal data (likely legitimate interests and/or legal obligation/legal-claims) and complete an appropriate balancing/transparency assessment. Decide how much complainant personal data is forwarded to an accused user versus redacted (see the Section 7 callout), since forwarding identity to a potentially adverse party is a meaningful data-protection decision. If notices may include **special-category data** (e.g., allegations) or generate cross-border transfers, address the relevant safeguards. Cross-check against the CCPA/CPRA disclosures in `privacy-policy.md` for U.S.-state residents.

## 14. Changes to this Policy

We may update this Policy from time to time. When we make material changes, we will revise the "Last updated" date above and, where appropriate, provide notice through the Service or by other reasonable means as described in the Terms of Service (see `terms-of-service.md`). Your continued use of the Service after a change takes effect constitutes acceptance of the revised Policy.

> ⚠️ COUNSEL: Confirm the change-notification mechanism and any advance-notice period are consistent with the amendment clause in `terms-of-service.md` and with any contractual notice commitments in customer agreements/DPAs.

## 15. Contact

- **DMCA / copyright notices:** [[Designated DMCA agent email]] (Designated DMCA Agent, Section 6)
- **General legal notices:** [[Notice email]]
- **Privacy / data protection:** [[Privacy/DPO contact]]

---

*This Policy is published by [[Company Legal Name]], [[Jurisdiction of incorporation]]. It is governed by and construed in accordance with [[Governing law]], without prejudice to any mandatory consumer or statutory protections that cannot be waived.*

> ⚠️ COUNSEL: Confirm governing law/venue for this Policy is consistent with `terms-of-service.md`. Note that the DMCA's effect (and any § 512(f) claims) arises under U.S. federal law regardless of the contractual governing-law clause; ensure the two are not presented as contradictory. Confirm whether any consumer-protection carve-out is needed in your target markets.
