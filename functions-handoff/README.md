# `sendInvite` — handoff to the FirstCabs functions repo

Sends **one** designed invitation email containing the real password-setup link.

That link is minted by `admin.auth().generatePasswordResetLink()`, which only the
Admin SDK can do — a browser cannot produce it. That is the entire reason this
has to be a Cloud Function rather than living in the admin panel.

---

## ⚠️ Do not deploy from the admin-panel repo

The admin panel repository has **no `functions/` directory**. Running
`firebase deploy --only functions` from there would tell Firebase your codebase
contains zero functions, and it would **delete all nine that are currently
live** (`onRideRequestCreated`, `onDispatchTick`, `onRidePaymentSettled`, and
the rest).

Copy these files into the repo that already holds those functions, and deploy
by name:

```bash
firebase deploy --only functions:sendInvite
```

Naming a single function never touches the others. `firebase.json` in the admin
panel repo deliberately has no `functions` key so this cannot happen by accident.

---

## Files

| File | Purpose |
|---|---|
| `sendInvite.cjs` | The callable function |
| `inviteEmail.cjs` | The email template — a copy of the panel's `src/lib/inviteEmail.js` |

`.cjs` because the admin panel is an ESM project and these are CommonJS. If your
functions repo is CommonJS, rename both to `.js` and fix the one `require` path
inside `sendInvite`. If it is ESM, convert the `module.exports` / `require` lines.

**No new npm dependencies.** Both email providers are called over plain `fetch`,
which Node 20 has built in.

## Install

1. Copy both files into your functions source directory.
2. Export it from your entry point:

   ```js
   exports.sendInvite = require('./sendInvite.cjs').sendInvite;
   ```

3. Set the API key as a **secret**, not an environment variable:

   ```bash
   firebase functions:secrets:set EMAIL_API_KEY
   ```

4. Set the non-secret parameters (or accept the defaults in the file):

   ```
   EMAIL_FROM=FirstCabs Admin <no-reply@yourdomain.com>
   EMAIL_PROVIDER=resend          # or: sendgrid
   APP_URL=https://fc-admin-panel.vercel.app
   ```

5. Deploy:

   ```bash
   firebase deploy --only functions:sendInvite
   ```

### Email provider

Defaults to **Resend** (`api.resend.com`); set `EMAIL_PROVIDER=sendgrid` to use
SendGrid instead. Either way the sending domain must be verified with that
provider, or mail will be rejected or land in spam.

## Behaviour

- Region `asia-south1`, Node 20, to match the existing deployment.
- Rejects any caller without an active `admin_users` record whose role is
  `admin` or `superadmin`. Only a `superadmin` may create another `superadmin`.
- If the email fails to send, the just-created Auth account is **deleted again**
  so the address is not left blocked by an orphan the admin cannot see.
- Writes its audit entry **server-side**, which closes the one gap in the panel's
  audit model: a client can decline to write its own log entry, a function cannot.

## Until it is deployed

Nothing breaks. The panel calls `sendInvite`, and on `not-found` falls back to
the browser-only path: it creates the account via a secondary app instance and
triggers Firebase's stock password-reset email. The same template is used, worded
to say a second email is coming. Once this function is live the panel switches to
it automatically — no change needed in the admin panel.
