const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendWebhook } = require('../utils/webhook');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('webhook')
    .setDescription('Send a message through a webhook')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('The webhook URL')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message content')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Webhook display name')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('avatar')
        .setDescription('Webhook avatar URL')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('embed')
        .setDescription('Send as embed?')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks),

  async execute(interaction) {
    const url = interaction.options.getString('url');
    const message = interaction.options.getString('message');
    const username = interaction.options.getString('username') || 'Infernix';
    const avatar = interaction.options.getString('avatar');
    const useEmbed = interaction.options.getBoolean('embed') || false;

    // Validate webhook URL
    if (!url.startsWith('https://discord.com/api/webhooks/') && !url.startsWith('https://discordapp.com/api/webhooks/')) {
      return interaction.reply({ content: 'Invalid webhook URL!', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const options = {
      username,
      avatarURL: avatar,
    };

    if (useEmbed) {
      const embed = new EmbedBuilder()
        .setColor(0xF97316)
        .setDescription(message)
        .setTimestamp();
      options.embeds = [embed];
    } else {
      options.content = message;
    }

    const success = await sendWebhook(url, options);

    if (success) {
      await interaction.editReply({ content: 'Webhook message sent successfully!'});
    } else {
      await interaction.editReply({ content: 'Failed to send webhook message. Check the URL.'});
    }
  },
};
