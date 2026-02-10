const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendLogWebhook } = require('../utils/webhook');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('Number of days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const days = interaction.options.getInteger('days') || 0;
    const member = interaction.guild.members.cache.get(user.id);

    if (member) {
      if (!member.bannable) {
        return interaction.reply({ content: 'I cannot ban this user. They may have higher permissions than me.', ephemeral: true });
      }

      if (member.id === interaction.user.id) {
        return interaction.reply({ content: 'You cannot ban yourself!', ephemeral: true });
      }
    }

    try {
      // DM the user before banning
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xDC2626)
          .setTitle('You have been banned')
          .setDescription(`You have been banned from **${interaction.guild.name}**`)
          .addFields({ name: 'Reason', value: reason })
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] });
      } catch (e) {
        // User has DMs disabled
      }

      await interaction.guild.members.ban(user, { 
        reason: `${reason} | Banned by ${interaction.user.tag}`,
        deleteMessageDays: days,
      });

      const embed = new EmbedBuilder()
        .setColor(0xDC2626)
        .setTitle('Member Banned')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason },
          { name: 'Messages Deleted', value: `${days} day(s)`, inline: true },
        )
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Log to webhook
      await sendLogWebhook('Member Banned', embed);

    } catch (error) {
      console.error('Ban error:', error);
      await interaction.reply({ content: 'Failed to ban user.', ephemeral: true });
    }
  },
};
