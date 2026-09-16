import { ROLES, ROLE_LABELS } from './roles.js';

/**
 * Renders the invitation email.
 *
 * Written for email clients, not browsers: tables for layout, inline styles
 * only, no flexbox, no external CSS, no web fonts, and a plain-text
 * alternative. Outlook ignores border-radius and background-image, so nothing
 * depends on either — the design degrades to plain blocks rather than breaking.
 */

const BRAND = {
    navy: '#101a2e',
    amber: '#f5b301',
    amberInk: '#1a1205',
    canvas: '#f4f6fa',
    surface: '#ffffff',
    line: '#e2e8f2',
    ink: '#131c2b',
    ink2: '#55677d',
    ink3: '#8a99ab',
};

// What each role actually lets someone do, in plain words rather than
// permission strings — the recipient has no idea what "audit.read" means.
const ROLE_GRANTS = {
    [ROLES.SUPERADMIN]: [
        'Full access to every part of the admin panel',
        'Add, remove and change the roles of other users',
        'View the complete audit log of all activity',
    ],
    [ROLES.ADMIN]: [
        'Manage rides, drivers, customers and advertisements',
        'Add and manage regular users',
        'View the audit log',
    ],
    [ROLES.VIEWER]: [
        'View and work with rides, drivers and customers',
        'Review payments, ratings and advertisements',
        'No access to user management or audit records',
    ],
};

const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const roleGrants = (role) => ROLE_GRANTS[role] ?? ROLE_GRANTS[ROLES.VIEWER];

/**
 * `setPasswordUrl` is the Admin-SDK-generated link. When the Cloud Function
 * sends this email it passes one, and the invitation becomes self-contained:
 * the button sets the password directly and only one email is sent. Without it
 * (the browser-only path) the button opens the panel and the email explains
 * that Firebase's own reset link is arriving separately.
 */
export const renderInviteEmail = ({
    inviteeEmail, inviteeName = '', inviterName, inviterEmail, role, appUrl,
    setPasswordUrl = null,
}) => {
    const roleLabel = ROLE_LABELS[role] || role;
    const article = /^[aeiou]/i.test(roleLabel) ? 'an' : 'a';
    const greeting = inviteeName ? `Hi ${esc(inviteeName)},` : 'Hi,';
    const inviter = esc(inviterName || inviterEmail);
    const grants = roleGrants(role);

    const subject = `${inviterName || inviterEmail} invited you to FirstCabs Admin`;
    const oneEmail = !!setPasswordUrl;
    const ctaHref = setPasswordUrl || appUrl;
    const ctaLabel = oneEmail ? 'Set your password' : 'Open FirstCabs Admin';

    // Shown in the inbox preview line, then hidden inside the message itself.
    const preheader = `You have been invited to join FirstCabs Admin as ${article} ${roleLabel}.`;

    const grantRows = grants.map((g) => `
              <tr>
                <td valign="top" style="padding:0 10px 8px 0;color:${BRAND.amber};font-size:15px;line-height:22px;">&#8226;</td>
                <td valign="top" style="padding:0 0 8px 0;color:${BRAND.ink2};font-size:14px;line-height:22px;">${esc(g)}</td>
              </tr>`).join('');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.canvas};padding:28px 12px;">
    <tr>
      <td align="center">
        <!-- width:100% with a max-width caps the card without letting the cell
             grow to 600px first, which is what made max-width:100% a no-op. -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${BRAND.surface};border:1px solid ${BRAND.line};border-radius:10px;overflow:hidden;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

          <!-- Brand bar -->
          <tr>
            <td style="background:${BRAND.navy};padding:20px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:10px;">
                    <div style="width:4px;height:26px;background:${BRAND.amber};border-radius:2px;font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                  <td>
                    <div style="color:${BRAND.amber};font-size:19px;font-weight:700;letter-spacing:-0.2px;">FirstCabs</div>
                    <div style="color:#7b8aa3;font-size:11px;letter-spacing:0.4px;padding-top:2px;">Ride. Anytime. Anywhere.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px 24px 8px 24px;">
              <p style="margin:0 0 18px 0;color:${BRAND.ink};font-size:15px;line-height:24px;">${greeting}</p>

              <h1 style="margin:0 0 14px 0;color:${BRAND.ink};font-size:22px;line-height:30px;font-weight:700;letter-spacing:-0.3px;">
                You have been invited to FirstCabs Admin
              </h1>

              <p style="margin:0 0 24px 0;color:${BRAND.ink2};font-size:15px;line-height:24px;">
                <strong style="color:${BRAND.ink};">${inviter}</strong> has invited you to join the FirstCabs
                administration panel as ${article} <strong style="color:${BRAND.ink};">${esc(roleLabel)}</strong>.
              </p>

              <!-- Role card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#fdf8ec;border:1px solid #f3e2b8;border-radius:8px;margin:0 0 26px 0;">
                <tr>
                  <td style="padding:18px 20px;">
                    <div style="color:${BRAND.ink3};font-size:11px;letter-spacing:1px;text-transform:uppercase;padding-bottom:6px;">Your role</div>
                    <div style="color:${BRAND.ink};font-size:17px;font-weight:700;padding-bottom:12px;">${esc(roleLabel)}</div>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">${grantRows}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;">
                <tr>
                  <td align="center" bgcolor="${BRAND.amber}" style="border-radius:6px;">
                    <a href="${esc(ctaHref)}" target="_blank"
                       style="display:inline-block;padding:13px 30px;color:${BRAND.amberInk};font-size:15px;font-weight:700;text-decoration:none;border-radius:6px;">
                      ${esc(ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Next steps -->
              <div style="color:${BRAND.ink3};font-size:11px;letter-spacing:1px;text-transform:uppercase;padding-bottom:10px;">${oneEmail ? 'What happens next' : 'Setting your password'}</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                ${oneEmail ? `
                <tr>
                  <td valign="top" width="24" style="padding:0 0 10px 0;color:${BRAND.ink3};font-size:13px;line-height:21px;">1.</td>
                  <td style="padding:0 0 10px 0;color:${BRAND.ink2};font-size:14px;line-height:21px;">
                    Use the button above to choose a password. The link is single-use and expires, so open it soon.
                  </td>
                </tr>
                <tr>
                  <td valign="top" width="24" style="padding:0 0 10px 0;color:${BRAND.ink3};font-size:13px;line-height:21px;">2.</td>
                  <td style="padding:0 0 10px 0;color:${BRAND.ink2};font-size:14px;line-height:21px;">
                    Sign in at <a href="${esc(appUrl)}" style="color:#1d4ed8;">${esc(appUrl.replace(/^https?:\/\//, ''))}</a>
                    with <strong style="color:${BRAND.ink};">${esc(inviteeEmail)}</strong> and that password.
                  </td>
                </tr>
                <tr>
                  <td valign="top" width="24" style="color:${BRAND.ink3};font-size:13px;line-height:21px;">3.</td>
                  <td style="color:${BRAND.ink2};font-size:14px;line-height:21px;">
                    Nobody at FirstCabs, including whoever invited you, ever sees your password.
                  </td>
                </tr>` : `
                <tr>
                  <td valign="top" width="24" style="padding:0 0 10px 0;color:${BRAND.ink3};font-size:13px;line-height:21px;">1.</td>
                  <td style="padding:0 0 10px 0;color:${BRAND.ink2};font-size:14px;line-height:21px;">
                    A separate email titled <strong style="color:${BRAND.ink};">&ldquo;Reset your password&rdquo;</strong> is on its way to
                    <strong style="color:${BRAND.ink};">${esc(inviteeEmail)}</strong>. It carries a secure, single-use link.
                  </td>
                </tr>
                <tr>
                  <td valign="top" width="24" style="padding:0 0 10px 0;color:${BRAND.ink3};font-size:13px;line-height:21px;">2.</td>
                  <td style="padding:0 0 10px 0;color:${BRAND.ink2};font-size:14px;line-height:21px;">
                    Open it and choose a password. Nobody at FirstCabs, including whoever invited you, ever sees it.
                  </td>
                </tr>
                <tr>
                  <td valign="top" width="24" style="color:${BRAND.ink3};font-size:13px;line-height:21px;">3.</td>
                  <td style="color:${BRAND.ink2};font-size:14px;line-height:21px;">
                    Sign in with your email and that password.
                  </td>
                </tr>`}
              </table>

              <!-- Security note -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:${BRAND.canvas};border-left:3px solid ${BRAND.line};border-radius:4px;">
                <tr>
                  <td style="padding:14px 16px;color:${BRAND.ink2};font-size:13px;line-height:20px;">
                    If you were not expecting this, you can ignore ${oneEmail ? 'this email' : 'both emails'} &mdash; the account cannot be
                    used until a password is set. Activity in the panel is recorded against your account.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 24px 28px 24px;">
              <div style="border-top:1px solid ${BRAND.line};padding-top:18px;">
                <p style="margin:0 0 6px 0;color:${BRAND.ink3};font-size:12px;line-height:19px;">
                  Invited by ${inviter}${inviterEmail ? ` &lt;${esc(inviterEmail)}&gt;` : ''}
                </p>
                <p style="margin:0;color:${BRAND.ink3};font-size:12px;line-height:19px;">
                  Sent to ${esc(inviteeEmail)} &middot; &copy; 2026 FirstCabs &middot; Ride. A Better Tomorrow.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = [
        preheader,
        '',
        greeting.replace(/<[^>]+>/g, ''),
        '',
        `${inviterName || inviterEmail} has invited you to join the FirstCabs administration panel as ${article} ${roleLabel}.`,
        '',
        `YOUR ROLE: ${roleLabel}`,
        ...grants.map((g) => `  - ${g}`),
        '',
        oneEmail ? 'WHAT HAPPENS NEXT' : 'SETTING YOUR PASSWORD',
        ...(oneEmail
            ? [
                '  1. Set your password using the link below. It is single-use and expires, so open it soon.',
                `  2. Sign in at ${appUrl} with ${inviteeEmail} and that password.`,
                '  3. Nobody at FirstCabs ever sees your password.',
                '',
                `Set your password: ${setPasswordUrl}`,
            ]
            : [
                `  1. A separate email titled "Reset your password" is on its way to ${inviteeEmail}.`,
                '  2. Open it and choose a password. Nobody at FirstCabs ever sees it.',
                '  3. Sign in with your email and that password.',
                '',
                `Open FirstCabs Admin: ${appUrl}`,
            ]),
        '',
        `If you were not expecting this you can ignore ${oneEmail ? 'this email' : 'both emails'} — the account cannot be used until a password is set.`,
        '',
        `Invited by ${inviterName || inviterEmail}${inviterEmail ? ` <${inviterEmail}>` : ''}`,
        `Sent to ${inviteeEmail} · © 2026 FirstCabs`,
    ].join('\n');

    return { subject, html, text, preheader };
};

/**
 * A paste-ready body for Firebase Console > Authentication > Templates.
 *
 * Firebase renders this itself, so it only knows its own placeholders:
 * %LINK%, %EMAIL%, %APP_NAME% and %DISPLAY_NAME%. There is no variable for who
 * invited the person or what role they were given, which is why this version
 * cannot say either — that personalisation needs an email provider we control.
 *
 * Kept deliberately simple: the console strips <style> blocks and some clients
 * see the body without the surrounding document, so everything is inline and
 * table-based, and it still reads correctly if every style is dropped.
 */
export const renderFirebaseResetTemplate = () => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.canvas};padding:24px 12px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:${BRAND.surface};border:1px solid ${BRAND.line};border-radius:10px;">
      <tr>
        <td style="background:${BRAND.navy};padding:20px 24px;border-radius:10px 10px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="padding-right:10px;"><div style="width:4px;height:24px;background:${BRAND.amber};border-radius:2px;font-size:0;line-height:0;">&nbsp;</div></td>
            <td>
              <div style="color:${BRAND.amber};font-size:18px;font-weight:700;">FirstCabs</div>
              <div style="color:#7b8aa3;font-size:11px;padding-top:2px;">Ride. Anytime. Anywhere.</div>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 24px 8px 24px;">
          <h1 style="margin:0 0 14px 0;color:${BRAND.ink};font-size:21px;line-height:29px;font-weight:700;">Set your password</h1>
          <p style="margin:0 0 22px 0;color:${BRAND.ink2};font-size:15px;line-height:24px;">
            Use the button below to set the password for your <strong style="color:${BRAND.ink};">FirstCabs Admin</strong>
            account, <strong style="color:${BRAND.ink};">%EMAIL%</strong>.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
            <tr><td align="center" bgcolor="${BRAND.amber}" style="border-radius:6px;">
              <a href="%LINK%" target="_blank" style="display:inline-block;padding:13px 30px;color:${BRAND.amberInk};font-size:15px;font-weight:700;text-decoration:none;border-radius:6px;">Set your password</a>
            </td></tr>
          </table>
          <p style="margin:0 0 18px 0;color:${BRAND.ink3};font-size:12px;line-height:19px;">
            If the button does not work, copy this link into your browser:<br>
            <a href="%LINK%" style="color:#1d4ed8;word-break:break-all;">%LINK%</a>
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.canvas};border-left:3px solid ${BRAND.line};border-radius:4px;">
            <tr><td style="padding:13px 15px;color:${BRAND.ink2};font-size:13px;line-height:20px;">
              The link works once and expires. If you were not expecting this you can ignore this email &mdash; nothing
              changes until a password is set.
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 24px 26px 24px;">
          <div style="border-top:1px solid ${BRAND.line};padding-top:16px;color:${BRAND.ink3};font-size:12px;line-height:19px;">
            Sent to %EMAIL% &middot; &copy; 2026 FirstCabs &middot; Ride. A Better Tomorrow.
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>`;
