# Invitation email — why it looks generic, why it lands in spam

Two separate problems with one shared cause: **Firebase is sending the mail, not us.**

| Symptom | Cause | Fixed by |
|---|---|---|
| Content is generic | Firebase renders its own template. Ours is only used by `sendInvite`, which is not deployed. | Step 1 (partly) or Step 3 (fully) |
| Lands in spam | Mail leaves `firebaseapp.com` shared infrastructure. Nothing authenticates it as FirstCabs, so no SPF or DKIM aligns with your domain. | Step 2 |

Wording changes cannot fix spam. Only sending from a domain you control can.

---

## Step 1 — Brand the email Firebase sends (5 minutes, no cost)

Firebase Console → **Authentication → Templates → Password reset → pencil icon**

- **Sender name:** `FirstCabs Admin`
- **Subject:** `Set your password for FirstCabs Admin`
- **Message:** paste the whole of [`firebase-reset-template.html`](./firebase-reset-template.html)

That replaces the plain-text-looking default with the navy header, the amber
button and the FirstCabs footer.

**What it still cannot say:** who invited the person, or what role they were
given. Firebase's template only exposes `%LINK%`, `%EMAIL%`, `%APP_NAME%` and
`%DISPLAY_NAME%` — there is no variable for either. That needs Step 3.

> This cannot be automated. The Identity Toolkit API rejects template writes with
> `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED` while the project uses the default sender.
> Completing Step 2 generally lifts that restriction.

---

## Step 2 — Stop the spam filing (the real fix)

Firebase Console → **Authentication → Templates → SMTP settings**

Point Firebase at an SMTP server you control. Mail then leaves your domain with
your SPF and DKIM records, which is what inbox placement actually depends on.

| Option | Setup | Notes |
|---|---|---|
| **Resend** | Verify a domain, create an SMTP credential | Free to 3,000/month. Best deliverability of the three. |
| **SendGrid** | Verify a domain, create an API key | Free to 100/day. |
| **Gmail / Workspace** | App password on an existing account | Fastest — no domain verification. Shows "via" in some clients, ~500/day cap. |

Any of them fixes spam for **every** auth email, including ordinary password
resets, not just invitations.

---

## Step 3 — The designed invitation (needs Step 2 first)

Deploy `sendInvite` from [`../functions-handoff/`](../functions-handoff/). It mints
the password link with the Admin SDK and sends **one** email — the full designed
invitation naming the inviter and the role, as previewed during development.

Until it is deployed the panel falls back automatically and nothing breaks; the
recipient gets Firebase's email (branded, if Step 1 is done) instead.

---

## Already fixed

- `fc-admin-panel.vercel.app` was missing from **authorized domains**, so auth
  links pointing at the live site would have been rejected. Added.
- A mistyped address used to fail silently — Firebase accepts a reset request for
  an address that does not exist and reports nothing. The invite form now warns,
  and every invited user has a **Resend invitation** action.
