import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'HOK Hub <noreply@hok-hub.project-n.site>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'Lisvindanu015@gmail.com';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendEmail(to, subject, html) {
  if (!resend) {
    console.log(`📧 [Email disabled - no RESEND_API_KEY] To: ${to} | Subject: ${subject}`);
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
    } else {
      console.log(`📧 Email sent to ${to}: ${subject} (id: ${data.id})`);
    }
  } catch (err) {
    console.error('Failed to send email:', err.message);
  }
}

export async function notifyContributionReceived(contribution, contributorEmail) {
  await sendEmail(
    ADMIN_EMAIL,
    '🎉 New Contribution Received - HOK Hub',
    `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
        <h2 style="color:#f59e0b;margin:0 0 16px;">New Contribution Received</h2>
        <p>A new contribution has been submitted and is pending review.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#94a3b8;">Type</td><td style="padding:8px;font-weight:bold;text-transform:uppercase;">${contribution.type}</td></tr>
          <tr><td style="padding:8px;color:#94a3b8;">ID</td><td style="padding:8px;font-family:monospace;">${contribution.id}</td></tr>
          <tr><td style="padding:8px;color:#94a3b8;">Submitted</td><td style="padding:8px;">${new Date(contribution.submittedAt).toLocaleString()}</td></tr>
          ${contributorEmail ? `<tr><td style="padding:8px;color:#94a3b8;">From</td><td style="padding:8px;">${contributorEmail}</td></tr>` : ''}
        </table>
        <a href="https://hok-hub.project-n.site/admin" style="display:inline-block;background:#f59e0b;color:#000;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">Review in Admin Panel</a>
      </div>
    `
  );
}

export async function notifyContributionApproved(contribution, contributorEmail) {
  if (!contributorEmail) return;
  await sendEmail(
    contributorEmail,
    '✅ Your contribution was approved - HOK Hub',
    `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
        <h2 style="color:#22c55e;margin:0 0 16px;">Contribution Approved!</h2>
        <p>Your contribution has been reviewed and approved. Thank you for helping improve the Honor of Kings Hub!</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#94a3b8;">Type</td><td style="padding:8px;font-weight:bold;text-transform:uppercase;">${contribution.type}</td></tr>
          <tr><td style="padding:8px;color:#94a3b8;">ID</td><td style="padding:8px;font-family:monospace;">${contribution.id}</td></tr>
          <tr><td style="padding:8px;color:#94a3b8;">Reviewed</td><td style="padding:8px;">${new Date().toLocaleString()}</td></tr>
        </table>
        <a href="https://hok-hub.project-n.site" style="display:inline-block;background:#22c55e;color:#000;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">Visit HOK Hub</a>
      </div>
    `
  );
}

export async function notifyContributionRejected(contribution, contributorEmail) {
  if (!contributorEmail) return;
  await sendEmail(
    contributorEmail,
    '❌ Your contribution was not approved - HOK Hub',
    `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
        <h2 style="color:#ef4444;margin:0 0 16px;">Contribution Not Approved</h2>
        <p>Your contribution was reviewed but could not be approved at this time.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#94a3b8;">Type</td><td style="padding:8px;font-weight:bold;text-transform:uppercase;">${contribution.type}</td></tr>
          <tr><td style="padding:8px;color:#94a3b8;">ID</td><td style="padding:8px;font-family:monospace;">${contribution.id}</td></tr>
          <tr><td style="padding:8px;color:#94a3b8;">Reviewed</td><td style="padding:8px;">${new Date().toLocaleString()}</td></tr>
        </table>
        <p style="color:#94a3b8;font-size:14px;">Possible reasons: incorrect or incomplete data, duplicate submission, or data doesn't match official sources.</p>
        <a href="https://hok-hub.project-n.site/contribute" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">Submit Again</a>
      </div>
    `
  );
}

export default {
  notifyContributionReceived,
  notifyContributionApproved,
  notifyContributionRejected,
};
