const sendResolutionEmail = async ({ to, name, workOrderId, title, resolution }) => {

  // -------------------------------------------------------
  // Sends resolution email notification to ticket requester.
  // Currently implemented as a console stub (no SMTP yet).
  // -------------------------------------------------------

  const payload = {
    to,
    subject: `Resolution for ${workOrderId}`,
    text: `
Hello ${name},

Your ticket ${workOrderId} has been closed.

Title: ${title}
Resolution: ${resolution || 'Resolved by technician head.'}

Thank you.
`
  };

  console.log('[MAIL STUB]', payload);

  return {
    success: true,
    message: 'Resolution email queued.'
  };
};

module.exports = { sendResolutionEmail };