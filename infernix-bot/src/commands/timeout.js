const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendLogWebhook } = require('../utils/webhook');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout (mute) a member')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to timeout')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Duration of the timeout')
        .setRequired(true)
        .addChoices(
          { name: '60 seconds', value: '60'},
          { name: '5 minutes', value: '300'},
          { name: '10 minutes', value: '600'},
          { name: '1 hour', value: '3600'},
          { name: '1 day', value: '86400'},
          { name: '1 week', value: '604800'},
        ))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the timeout')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const duration = parseInt(interaction.options.getString('duration'));
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({ content: 'I cannot timeout this user. They may have higher permissions than me.', ephemeral: true });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot timeout yourself!', ephemeral: true });
    }

    const durationLabels = {
      60: '60 seconds',
      300: '5 minutes',
      600: '10 minutes',
      3600: '1 hour',
      86400: '1 day',
      604800: '1 week',
    };

    try {
      await member.timeout(duration * 1000, reason);

      const embed = new EmbedBuilder()
        .setColor(0xFBBF24)
        .setTitle('⏱ Member Timed Out')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Duration', value: durationLabels[duration] || `${duration}s`, inline: true },
          { name: 'Reason', value: reason },
        )
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Log to webhook
      await sendLogWebhook('Member Timed Out', embed);

    } catch (error) {
      console.error('Timeout error:', error);
      await interaction.reply({ content: 'Failed to timeout user.', ephemeral: true });
    }
  },
};
