function sendNewLeadNotification(lead) {
  if (process.env.NOTIFICATION_EMAIL) {
    console.log(`New lead received from ${lead.name} (${lead.email}).`);
  }
}

module.exports = { sendNewLeadNotification };