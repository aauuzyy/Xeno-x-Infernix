const { WebhookClient, EmbedBuilder } = require('discord.js');

/**
 * Send a message to the logs webhook
 * @param {string} title - The title of the log
 * @param {EmbedBuilder} embed - The embed to send
 */
async function sendLogWebhook(title, embed) {
  const webhookUrl = process.env.WEBHOOK_LOGS;
  if (!webhookUrl) return;

  try {
    const webhook = new WebhookClient({ url: webhookUrl });
    await webhook.send({
      username: 'Infernix Logs',
      embeds: [embed],
    });
    webhook.destroy();
  } catch (error) {
    console.error('Failed to send log webhook:', error);
  }
}

/**
 * Send an announcement to the announcements webhook
 * @param {string} title - The announcement title
 * @param {string} message - The announcement message
 * @param {string} color - Hex color for the embed
 */
async function sendAnnouncementWebhook(title, message, color = '#F97316') {
  const webhookUrl = process.env.WEBHOOK_ANNOUNCEMENTS;
  if (!webhookUrl) return;

  try {
    const webhook = new WebhookClient({ url: webhookUrl });
    
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(` ${title}`)
      .setDescription(message)
      .setTimestamp();

    await webhook.send({
      username: 'Infernix Announcements',
      content: '@everyone',
      embeds: [embed],
    });
    webhook.destroy();
  } catch (error) {
    console.error('Failed to send announcement webhook:', error);
  }
}

/**
 * Send a custom webhook message
 * @param {string} webhookUrl - The webhook URL
 * @param {object} options - Message options (content, embeds, username, etc.)
 */
async function sendWebhook(webhookUrl, options) {
  if (!webhookUrl) return false;

  try {
    const webhook = new WebhookClient({ url: webhookUrl });
    await webhook.send(options);
    webhook.destroy();
    return true;
  } catch (error) {
    console.error('Failed to send webhook:', error);
    return false;
  }
}

module.exports = {
  sendLogWebhook,
  sendAnnouncementWebhook,
  sendWebhook,
};
