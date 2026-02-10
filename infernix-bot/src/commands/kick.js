const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendLogWebhook } = require('../utils/webhook');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    if (!member.kickable) {
      return interaction.reply({ content: 'I cannot kick this user. They may have higher permissions than me.', ephemeral: true });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot kick yourself!', ephemeral: true });
    }

    try {
      // DM the user before kicking
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xEF4444)
          .setTitle('You have been kicked')
          .setDescription(`You have been kicked from **${interaction.guild.name}**`)
          .addFields({ name: 'Reason', value: reason })
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] });
      } catch (e) {
        // User has DMs disabled
      }

      await member.kick(reason);

      const embed = new EmbedBuilder()
        .setColor(0xEF4444)
        .setTitle('Member Kicked')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason },
        )
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Log to webhook
      await sendLogWebhook('Member Kicked', embed);

    } catch (error) {
      console.error('Kick error:', error);
      await interaction.reply({ content: 'Failed to kick user.', ephemeral: true });
    }
  },
};
