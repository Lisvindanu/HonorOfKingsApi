// Simple email notification service
// Configure via environment variables

const ENABLED = process.env.EMAIL_NOTIFICATIONS === 'true';
const WEBHOOK_URL = process.env.EMAIL_WEBHOOK_URL; // For services like Discord, Slack, etc.

async function notifyContributionReceived(contribution) {
  if (!ENABLED) {
    console.log('📧 Email notifications disabled');
    return;
  }

  const message = `
🎉 New Contribution Received!

Type: ${contribution.type.toUpperCase()}
ID: ${contribution.id}
Submitted: ${new Date(contribution.submittedAt).toLocaleString()}

Status: Pending Review

The contribution is now in the admin review queue.
  `.trim();

  await sendNotification('New Contribution', message);
}

async function notifyContributionApproved(contribution) {
  if (!ENABLED) {
    console.log('📧 Email notifications disabled');
    return;
  }

  const message = `
✅ Contribution Approved!

Your contribution has been reviewed and approved!

Type: ${contribution.type.toUpperCase()}
ID: ${contribution.id}
Reviewed: ${new Date().toLocaleString()}

Your contribution has been merged into the main database.
Thank you for helping improve the Honor of Kings Hub!
  `.trim();

  await sendNotification('Contribution Approved', message);
}

async function notifyContributionRejected(contribution) {
  if (!ENABLED) {
    console.log('📧 Email notifications disabled');
    return;
  }

  const message = `
❌ Contribution Not Approved

Your contribution was reviewed but could not be approved at this time.

Type: ${contribution.type.toUpperCase()}
ID: ${contribution.id}
Reviewed: ${new Date().toLocaleString()}

Possible reasons:
- Incorrect or incomplete data
- Duplicate submission
- Data doesn't match official sources

You can submit a new contribution with corrected information.
  `.trim();

  await sendNotification('Contribution Not Approved', message);
}

async function sendNotification(subject, message) {
  try {
    if (WEBHOOK_URL) {
      // Send to webhook (Discord, Slack, etc.)
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `**${subject}**\n\n${message}`
        })
      });

      if (response.ok) {
        console.log(`📧 Notification sent: ${subject}`);
      }
    } else {
      // Just log to console
      console.log(`📧 Notification: ${subject}`);
      console.log(message);
    }
  } catch (error) {
    console.error('Failed to send notification:', error.message);
  }
}

export default {
  notifyContributionReceived,
  notifyContributionApproved,
  notifyContributionRejected
};
