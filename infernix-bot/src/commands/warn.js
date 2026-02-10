const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendLogWebhook } = require('../utils/webhook');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to warn')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    // DM the user
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xFBBF24)
        .setTitle('Warning')
        .setDescription(`You have received a warning in **${interaction.guild.name}**`)
        .addFields(
          { name: 'Reason', value: reason },
          { name: 'Moderator', value: interaction.user.tag },
        )
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] });
    } catch (e) {
      // User has DMs disabled
    }

    const embed = new EmbedBuilder()
      .setColor(0xFBBF24)
      .setTitle('Member Warned')
      .addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true },
        { name: 'Reason', value: reason },
      )
      .setThumbnail(user.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Log to webhook
    await sendLogWebhook('Member Warned', embed);
  },
};
