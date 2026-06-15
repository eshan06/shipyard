> **DRAFT — FOR REVIEW BY [COMPANY]'s LEGAL COUNSEL. NOT LEGAL ADVICE.**
> This template was generated to give counsel a tailored starting point. It has NOT been reviewed by a lawyer.
> Do not publish or rely on it until your counsel has reviewed and adapted it for your jurisdiction(s) and business.
> Search this file for `[[ ]]` placeholders and `> ⚠️ COUNSEL:` callouts — each marks a decision counsel must make.

# Shipyard — Cookie & Similar-Technologies Policy

**Operated by [[Company Legal Name]] ("Shipyard", "we", "us", "our")**
**Effective date: [[Effective date]]**
**Last updated: [[Last updated date]]**

This Cookie Policy explains how Shipyard uses cookies, browser local storage, and similar
technologies on the **Shipyard web dashboard** at [[Dashboard URL, e.g. app.shipyard.example]] and
on our marketing site at [[Marketing site URL, if applicable]] (together, the "Sites"). Shipyard is
a B2B SaaS "preview environments manager": for each GitHub pull request we build and run your
application stack in isolated, ephemeral containers and return a shareable preview URL.

This policy covers only the technologies set by, or through, the Sites you interact with directly.
It does **not** cover:

- Cookies or storage set **inside a preview environment** by **your own application code**. Preview
  environments run **your** code, on a Shipyard-provided subdomain, and any cookies that code sets
  are governed by **your** application's own cookie/privacy practices, not this policy. You are
  responsible for the behaviour of code you deploy (see [acceptable-use-policy.md](./acceptable-use-policy.md)
  and [terms-of-service.md](./terms-of-service.md)).
- Cookies set by third-party sites you navigate to from a preview URL or from links in our product.

For how we handle personal data generally, see our [privacy-policy.md](./privacy-policy.md). For the
third parties that may process data on our behalf, see [subprocessors.md](./subprocessors.md).

---

## Table of Contents

1. [What are cookies and similar technologies?](#1-what-are-cookies-and-similar-technologies)
2. [How we categorise cookies](#2-how-we-categorise-cookies)
3. [Strictly necessary cookies](#3-strictly-necessary-cookies)
4. [Functional storage and cookies](#4-functional-storage-and-cookies)
5. [Analytics and performance technologies](#5-analytics-and-performance-technologies)
6. [Advertising / targeting cookies](#6-advertising--targeting-cookies)
7. [Cookie and storage table](#7-cookie-and-storage-table)
8. [Consent and your choices](#8-consent-and-your-choices)
9. [How to manage or delete cookies](#9-how-to-manage-or-delete-cookies)
10. [Do Not Track and Global Privacy Control](#10-do-not-track-and-global-privacy-control)
11. [Cookies inside preview environments](#11-cookies-inside-preview-environments)
    - 11.1 [What we do **not** store in your browser](#111-what-we-do-not-store-in-your-browser)
12. [Changes to this policy](#12-changes-to-this-policy)
13. [Contact](#13-contact)

---

## 1. What are cookies and similar technologies?

A **cookie** is a small text file that a website asks your browser to store and send back on later
visits. Cookies may be **first-party** (set by the domain you are visiting — here, Shipyard) or
**third-party** (set by another domain, such as an analytics provider).

A cookie is a **session cookie** if it is deleted when you close your browser, or a **persistent
cookie** if it remains until it expires or you delete it.

"Similar technologies" we may use include:

- **Local storage / session storage** — key-value data your browser keeps for a site. The Shipyard
  dashboard uses **local storage** for some preferences (see Section 4). Unlike cookies, local
  storage is not automatically transmitted to our servers on every request.
- **Software tokens** held in cookies or storage (for example, our authentication session token).

Throughout this policy we use "cookies" as shorthand for cookies, local storage, and similar
client-side technologies, unless we say otherwise.

> ⚠️ COUNSEL: In the EU/UK, the rules on cookies (ePrivacy Directive art. 5(3), as implemented in
> member-state law and the UK PECR) apply to **storing or accessing information on a user's device**
> — which expressly includes **local storage**, not just HTTP cookies. Confirm the consent analysis
> in Sections 4–5 treats local storage and cookies under the same legal test.

---

## 2. How we categorise cookies

We group the technologies we use into four categories, in line with common EU/UK and US-state
practice:

1. **Strictly necessary** — required to deliver the dashboard you have asked for (authentication,
   security, load balancing). Without these the service cannot function. (Section 3.)
2. **Functional** — remember your preferences to improve your experience (e.g. light/dark theme).
   (Section 4.)
3. **Analytics / performance** — help us understand product usage so we can improve Shipyard.
   (Section 5.)
4. **Advertising / targeting** — used to build profiles and serve ads. **Shipyard does not use
   these.** (Section 6.)

> ⚠️ COUNSEL: Under EU/UK law, only **strictly necessary** cookies are exempt from prior consent.
> Functional and analytics technologies generally require consent (or, where allowed by national
> guidance, may rely on a narrower exemption for first-party analytics — this varies by member
> state and is **not** uniform). Under US state laws (CCPA/CPRA, VCDPA, CPA, etc.), the framing is
> different: there is generally no opt-in consent requirement for first-party analytics, but
> consumers must be able to opt out of "sale"/"sharing" and certain cross-context behavioural
> advertising, and you must honour opt-out preference signals (see Section 10). Counsel must decide
> the consent model per jurisdiction and confirm how the categories above map to the consent banner
> (Section 8).

---

## 3. Strictly necessary cookies

These cookies are essential for you to sign in to and use the Shipyard dashboard. They cannot be
switched off through our product because the service would not work without them. They do **not**
require consent under EU/UK law, but we still disclose them here for transparency.

- **`sy_session` — authentication session.** When you sign in (via GitHub OAuth), Shipyard sets a
  first-party cookie named `sy_session` containing a signed session token (an HS256-signed JWT whose
  subject identifies your user account). It is set with the `HttpOnly` flag (so it is not readable by
  JavaScript), `SameSite=Lax`, and the `Secure` flag in production (so it is only sent over HTTPS).
  It is a persistent cookie with a maximum lifetime of **[[Session cookie lifetime — current default 30 days]]**.
  Clearing it (or logging out) signs you out.

  > ⚠️ COUNSEL: Confirm the disclosed session lifetime matches the implemented value. The current
  > default in the codebase is a 30-day max-age (`SESSION_MAX_AGE_SECONDS`). If you adopt a shorter
  > "remember me" vs. plain-session distinction, or rotate/refresh tokens, update this disclosure.

- **`sy_oauth_state` — OAuth security / CSRF protection.** During the GitHub sign-in round-trip we
  set a short-lived first-party cookie named `sy_oauth_state` holding a random `state` nonce. We
  compare it on the OAuth callback to prevent cross-site request forgery (CSRF) and login-CSRF
  attacks. It is `HttpOnly`, `SameSite=Lax`, `Secure` in production, and is deleted as soon as the
  sign-in completes.

- **Load-balancing / routing cookie.** Where Shipyard is served behind a load balancer or reverse
  proxy that uses session affinity ("sticky sessions"), the load balancer may set a routing cookie
  (for example `[[Load-balancer cookie name, e.g. sy_lb / AWSALB / GCLB]]`) to keep your requests on
  a consistent backend. This is operational and contains no profile data.

  > ⚠️ COUNSEL: Confirm whether the production deployment actually uses sticky-session affinity and,
  > if so, the exact cookie name and provider (e.g. the cloud load balancer, or an ingress
  > controller in Kubernetes). If no LB cookie is set, delete this bullet and the corresponding
  > table row.

> ⚠️ COUNSEL: We classify `sy_session`, `sy_oauth_state`, and any load-balancing cookie as
> "strictly necessary." This is defensible because each is required to deliver a service the user
> has actively requested (a logged-in session, secured sign-in, reliable routing). Validate this
> classification against current EDPB guidance and any applicable national DPA guidance, since
> regulators scrutinise over-broad "strictly necessary" claims.

---

## 4. Functional storage and cookies

These remember choices you make to give you a better experience. They are **not** essential to the
core service.

- **Theme preference.** The dashboard remembers whether you chose light, dark, or system theme. This
  preference is stored in your browser's **local storage** under the key
  [[Theme storage key — confirm; the dashboard uses the `next-themes` library, whose default key is
  `theme` unless overridden]]. It stays on your device, is not transmitted to our servers, and is used
  only to render the interface in your chosen theme.

> ⚠️ COUNSEL / ENGINEERING: Verify the actual `next-themes` storage key before publication. As
> implemented, the theme provider sets no custom `storageKey`, so `next-themes` writes to its default
> key `theme` in local storage; if a `storageKey` is later configured, update the disclosure and the
> Section 7 table.

> ⚠️ COUNSEL / ENGINEERING: The bullets below describe functional storage that the product **may**
> add but that is **not present in the current codebase** (as of this draft, the **only** client-side
> functional storage is the `next-themes` theme key above; there is no onboarding-checklist flag and
> no other UI-preference storage). Do **not** publish these bullets, or the corresponding Section 7
> rows, as descriptions of live behaviour until engineering confirms each one actually ships and
> provides the exact key name. Delete any that do not apply.

- **[[If implemented]] Onboarding / product-tour state.** If the dashboard adds an onboarding
  checklist or product tour that can be dismissed, the "dismissed" flag would be stored
  **client-side** (in local storage, key `[[Onboarding flag key — confirm before publishing]]`) so it
  is not shown again on that device. It would contain no personal data beyond the dismissal fact.

- **[[If implemented]] Other UI preferences.** The dashboard may later store low-sensitivity
  interface preferences (for example, a remembered table view, sidebar collapsed/expanded state, or a
  "last selected team") in local storage to make the dashboard more convenient. Confirm the exact
  keys and that no preference includes personal data beyond a UI choice.

> ⚠️ COUNSEL: In the EU/UK, functional storage that is not strictly necessary generally requires
> consent before it is set. Because the theme preference is written **client-side as soon as the
> dashboard loads**, counsel must decide whether (a) to treat it as a low-risk first-party preference
> set only after the user is authenticated and has had notice, (b) to gate it behind the consent
> banner, or (c) to rely on a national exemption. The same analysis applies to any future onboarding/
> UI-preference storage. Note these are written to **local storage**, which is in scope for the EU/UK
> consent rules just as cookies are.

---

## 5. Analytics and performance technologies

Shipyard collects **product analytics / telemetry** — events such as `user.login`,
`project.created`, and `preview.deployed` — tied to user and team identifiers, so we can understand
how the product is used, diagnose problems, and improve it. How (and whether) this involves cookies
or device storage **depends on where the telemetry is sent**, which is configurable:

- **Default — self-hosted log sink.** By default, telemetry is written to a server-side log sink
  operated by Shipyard. In this configuration, analytics events are generated **server-side** and we
  do **not** set analytics cookies or analytics identifiers in your browser for this purpose.
- **Generic HTTP endpoint.** Telemetry may be routed to a configurable HTTP endpoint. Whether this
  sets any browser-side identifier depends on the endpoint's configuration.
- **PostHog.** If telemetry is routed to PostHog, PostHog may set **first-party** cookies and/or use
  local storage (for example `ph_*` identifiers) to recognise sessions and de-duplicate events. In
  that configuration, analytics cookies/identifiers **are** used and PostHog acts as a processor
  /subprocessor (see [subprocessors.md](./subprocessors.md)).

We do **not** use these analytics technologies to advertise to you or to build cross-site
advertising profiles (see Section 6).

> ⚠️ COUNSEL: This is the most consent-sensitive section. **In the EU/UK, analytics that set cookies
> or device identifiers — including PostHog's client-side cookies/local storage — require prior
> opt-in consent** (and you must not set them before consent is given, nor make consent a condition
> of using the service). Counsel must (1) confirm which sink is used in production for the relevant
> audience; (2) ensure the consent banner (Section 8) blocks analytics technologies in the EU/UK
> until consent is granted; (3) if PostHog is used, confirm its cookie/identifier behaviour, IP-
> handling, and international-transfer position match the privacy-policy.md and subprocessors.md;
> and (4) decide the US-state position (generally no opt-in needed for first-party analytics, but
> opt-out and preference-signal obligations may apply — see Section 10). If the analytics sink ever
> changes to one that sets browser cookies/identifiers, **this policy and the table in Section 7
> must be updated and the consent model re-assessed.**

> ⚠️ COUNSEL: Even when telemetry is generated server-side (default sink), it ties events to
> user/team IDs and is "personal data" for GDPR purposes. The **lawful basis** for that server-side
> analytics (e.g. legitimate interests) is a privacy-policy.md question, not a cookie-law question,
> but the two analyses should be consistent.

---

## 6. Advertising / targeting cookies

**Shipyard does not use advertising or targeting cookies on the Sites.** We do not run third-party
ad networks on the dashboard, we do not use cookies to serve behavioural advertising, and we do not
"sell" or "share" personal data for cross-context behavioural advertising as those terms are defined
under US state privacy laws, through cookies on the Sites.

> ⚠️ COUNSEL: This statement is currently accurate to the described architecture. If marketing later
> adds advertising/retargeting pixels (e.g. on the marketing site), conversion tags, or social
> "share" widgets that set third-party cookies, this section becomes **false** and must be rewritten,
> a new cookie category and table rows added, and — critically — the CCPA/CPRA (and other US-state)
> "Do Not Sell or Share My Personal Information" / opt-out and Global Privacy Control obligations,
> and EU/UK opt-in consent, must be implemented. Treat any addition of advertising/marketing tags as
> a trigger to revisit this whole policy.

---

## 7. Cookie and storage table

The following table lists the cookies and similar technologies the Sites may use. Exact names,
providers, and expiries must be confirmed by counsel/engineering before publication; values shown as
`[[ ]]` are placeholders. Third-party rows apply **only** in the configurations noted (e.g. PostHog
analytics, or a load balancer with sticky sessions).

| Name | Provider | Purpose | Type | Expiry |
| --- | --- | --- | --- | --- |
| `sy_session` | Shipyard (first-party) | Authentication — keeps you signed in (signed session JWT, subject = user account; `HttpOnly`, `SameSite=Lax`, `Secure` in prod) | Strictly necessary (cookie) | Persistent — [[Session cookie lifetime — current default 30 days]] |
| `sy_oauth_state` | Shipyard (first-party) | Security / CSRF protection during GitHub OAuth sign-in (`HttpOnly`, `SameSite=Lax`, `Secure` in prod) | Strictly necessary (cookie) | Session / transient — deleted after sign-in completes |
| `[[Load-balancer cookie name]]` | [[Load-balancer / hosting provider]] | Session affinity / routing to a consistent backend (only if sticky sessions are enabled) | Strictly necessary (cookie) | [[LB cookie expiry — often session]] |
| [[Theme storage key — `next-themes` default `theme` unless overridden]] | Shipyard (first-party) | Remembers light/dark/system theme preference (stored in **local storage**, not transmitted) | Functional (local storage) | Persists until cleared by the user |
| `[[Onboarding flag key]]` | Shipyard (first-party) | Remembers that an onboarding checklist/tour was dismissed (stored in **local storage**) — **only if implemented; not present in the current codebase** | Functional (local storage) | Persists until cleared by the user |
| `[[UI preference key(s)]]` | Shipyard (first-party) | Remembers low-sensitivity UI preferences (e.g. last selected team, view options) — **only if implemented; not present in the current codebase** | Functional (local storage) | Persists until cleared by the user |
| `ph_[[project key]]_posthog` / `ph_*` | PostHog (first-party, **only if PostHog sink is configured**) | Product analytics — recognises sessions, de-duplicates telemetry events | Analytics / performance (cookie + local storage) | [[PostHog cookie expiry — confirm with provider]] |
| `[[Generic HTTP analytics identifier, if any]]` | [[Analytics endpoint provider]] | Product analytics, **only if** telemetry is routed to an endpoint that sets a browser identifier | Analytics / performance | [[Confirm]] |

> ⚠️ COUNSEL: Before publishing, run a live cookie/storage scan of the production dashboard **and**
> marketing site (e.g. browser dev-tools Application tab, or a scanning tool) in each
> telemetry-sink configuration you actually ship, and reconcile the results against this table. The
> table must reflect what is actually set, not just what is intended. Remove placeholder rows that
> do not apply (e.g. the PostHog and generic-endpoint rows if the default self-hosted sink is used;
> the load-balancer row if no sticky sessions; and the onboarding/UI-preference rows, which are
> **not present in the current codebase** and must not be published until engineering confirms they
> ship with confirmed key names).

---

## 8. Consent and your choices

How we ask for consent depends on your location and on which cookies/technologies are in play:

- **Strictly necessary** technologies (Section 3) are always active because the dashboard cannot
  function without them. They do not require, and are not subject to, consent.
- **Functional and analytics** technologies (Sections 4–5) are subject to your choices. Where the
  law requires opt-in consent (notably the EU/UK), we will not set non-essential cookies or write
  non-essential device storage until you have consented, and you can change or withdraw your choice
  at any time.

**Consent banner / preference centre.** Where required, the Sites present a cookie consent banner and
a preference centre that let you accept or reject non-essential categories and review this policy.
You can re-open the preference centre at any time via [[Link/location of "Cookie settings" control,
e.g. footer link]].

> ⚠️ COUNSEL: Decide whether a dedicated **Consent Management Platform (CMP)** is needed.
> - **EU/UK:** If any non-essential cookie/storage is used (functional preferences set client-side,
>   or PostHog/HTTP analytics that set identifiers), a compliant CMP/consent banner is effectively
>   required, with: (a) granular per-category opt-in, (b) reject being as easy as accept, (c) **no**
>   non-essential technologies firing before consent, (d) a record of consent, and (e) easy
>   withdrawal. If Shipyard ever uses an EU/UK-targeted **advertising** vendor, IAB TCF / Google
>   consent-mode considerations also arise.
> - **US (CCPA/CPRA and similar):** A CMP is generally **not** required for opt-in, but you likely
>   need a "Do Not Sell or Share My Personal Information" / opt-out mechanism **if** any technology
>   qualifies as a sale/share or cross-context behavioural advertising, and you must honour the
>   Global Privacy Control signal (Section 10).
> Counsel should also decide whether to geo-gate behaviour (strict opt-in banner for EU/UK visitors;
> lighter notice + opt-out for US visitors) and whether a banner is needed at all if **only**
> strictly-necessary cookies plus client-side functional preferences are used under the default
> self-hosted analytics sink.

> ⚠️ COUNSEL: Note the B2B nuance. Many dashboard users reach Shipyard already authenticated through
> their employer's GitHub account. Consent obligations still attach to the **individual's** device
> and personal data, so a B2B relationship does **not** remove EU/UK cookie-consent duties for
> non-essential technologies. Confirm the analysis.

---

## 9. How to manage or delete cookies

In addition to any consent controls we provide, you can manage cookies and storage through your
browser:

- **Block or delete cookies** and clear site data via your browser settings. Most browsers let you
  block third-party cookies, delete existing cookies, and clear local storage for a specific site.
- **Clear Shipyard's local storage** (your theme preference, and any other interface preferences the
  dashboard stores client-side) by clearing site data for the dashboard domain in your browser's
  settings.
- **Sign out** to clear your `sy_session` cookie.

Vendor instructions:

- Google Chrome: [[Link to Chrome cookie-settings help]]
- Mozilla Firefox: [[Link to Firefox cookie-settings help]]
- Apple Safari: [[Link to Safari cookie-settings help]]
- Microsoft Edge: [[Link to Edge cookie-settings help]]

Please note: if you block or delete **strictly necessary** cookies, the dashboard may not work — for
example, you may be unable to stay signed in or to complete GitHub sign-in. Blocking functional
storage means we cannot remember your preferences (e.g. your theme).

> ⚠️ COUNSEL: Confirm whether to include direct deep-links to each browser's help pages (they change
> over time) or generic guidance only. Some organisations prefer generic guidance to avoid
> maintaining dead links.

---

## 10. Do Not Track and Global Privacy Control

Some browsers offer a "Do Not Track" (DNT) signal. Because there is no agreed industry standard for
how to interpret DNT, the Sites [[do / do not]] respond to DNT signals.

Separately, certain US state laws require that we treat a recognised opt-out preference signal — such
as the **Global Privacy Control (GPC)** — as a valid request to opt out of "sale"/"sharing" of
personal data and/or targeted advertising for that browser.

> ⚠️ COUNSEL: Decide and state the DNT position. More importantly, under CCPA/CPRA (and several other
> US state laws) honouring **GPC** is **mandatory** to the extent any processing constitutes a
> sale/share or targeted advertising. Because Shipyard currently states it uses no advertising
> cookies (Section 6), there may be no "sale/share" to opt out of — but counsel must confirm whether
> any analytics configuration (e.g. PostHog) could be characterised as a sale/share under broad
> state-law definitions, and implement GPC handling accordingly. Reconcile with privacy-policy.md.

---

## 11. Cookies inside preview environments

Preview environments run **your** application code in isolated, ephemeral containers and are served
on a Shipyard-provided preview URL (typically a subdomain). Any cookies, local storage, tracking
pixels, or similar technologies that your application sets inside a preview are determined by **your
code**, not by Shipyard, and are **not** covered by this policy. You are responsible for the privacy
and cookie compliance of the applications you deploy, including obtaining any consent your own users
require.

This division of responsibility is consistent with the rest of the Shipyard terms: as between you
and Shipyard, you control the code that runs in previews (see [terms-of-service.md](./terms-of-service.md)
and [acceptable-use-policy.md](./acceptable-use-policy.md)); where Shipyard processes personal data
contained in your repositories, seed data, or databases on your behalf, it does so as a **processor**
under the [data-processing-addendum.md](./data-processing-addendum.md), and you are the controller.

> ⚠️ COUNSEL / EDITORIAL: The canonical DPA filename across the legal suite is
> `data-processing-addendum.md`, and every cross-reference in `privacy-policy.md`, `subprocessors.md`,
> `acceptable-use-policy.md`, `dmca-copyright-policy.md`, the terms, and this policy has been
> reconciled to it. If you rename or relocate the DPA at publication (for example to a hosted URL),
> update all sibling cross-references again so no link is broken.

> ⚠️ COUNSEL: Confirm the preview-subdomain architecture and whether previews share a parent domain
> with the dashboard such that cookies could, in principle, be scoped across both (a security and
> compliance concern). Engineering should confirm cookie domain scoping isolates preview cookies
> from `sy_session`. Align this section with the security annex (see [security.md](./security.md)).

### 11.1 What we do **not** store in your browser

For clarity, and because Shipyard handles sensitive material, the following are **never** placed in
cookies or browser storage by the Sites:

- **Customer secrets and environment variables.** Secrets you store for use by previews are held
  encrypted at rest (AES-256-GCM) on the server side and are **never** returned in plaintext through
  the API or UI, and **never** written to a cookie or to browser storage. (See [privacy-policy.md](./privacy-policy.md)
  and the security annex, [security.md](./security.md).)
- **GitHub credentials.** The GitHub App installation token, webhook signing secret, and any deploy
  keys are server-side material; they are **not** stored in your browser. Sign-in uses GitHub OAuth,
  after which only the `sy_session` cookie described in Section 3 is set.
- **CLI / CI API tokens.** API tokens used by the Shipyard CLI or CI (sent as
  `Authorization: Bearer <token>`) are **not** cookies and are not set by the Sites in your browser;
  they are issued to you to store in your own environment. This Cookie Policy does not govern them.

> ⚠️ COUNSEL / ENGINEERING: Confirm these negative assurances against the current implementation
> before publication (e.g. that no debug/feature-flag build writes secrets, tokens, or decrypted
> environment variables to `localStorage`/`sessionStorage` or to a non-`HttpOnly` cookie). If any
> such behaviour exists or is added, this subsection becomes inaccurate and must be corrected, and a
> security review is warranted.

---

## 12. Changes to this policy

We may update this Cookie Policy to reflect changes in the technologies we use, in our products, or
in the law. When we make material changes, we will update the "Last updated" date above and, where
required, provide additional notice (for example, by re-surfacing the consent banner). We encourage
you to review this policy periodically.

> ⚠️ COUNSEL: Decide what counts as a "material change" triggering re-consent (e.g. adding any new
> non-essential cookie, switching the analytics sink to one that sets identifiers, or adding any
> advertising technology should re-trigger the EU/UK consent flow).

---

## 13. Contact

Questions about this Cookie Policy or our use of cookies and similar technologies:

- **Email:** [[Privacy/DPO contact]]
- **Postal address:** [[Company Legal Name]], [[Registered address]]
- **Data protection contact / DPO (if appointed):** [[DPO name/contact — if applicable]]
- **EU / UK representative (if appointed):** [[Art. 27 GDPR representative — if applicable]]

For more on how we handle personal data, see [privacy-policy.md](./privacy-policy.md); for the third
parties that may process data on our behalf, see [subprocessors.md](./subprocessors.md).

> ⚠️ COUNSEL: Decide whether a DPO is mandatory (GDPR Art. 37) and whether an EU and/or UK Art. 27
> representative is required (no establishment in the EU/UK but offering services to / monitoring
> individuals there). Populate or remove the corresponding contact lines accordingly, and keep them
> consistent with privacy-policy.md.

---

*End of Cookie Policy. This is a counsel-review draft — see the banner at the top of this file.*
