const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete multiple messages')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Only delete messages from this user')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const user = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    try {
      let messages = await interaction.channel.messages.fetch({ limit: amount });

      if (user) {
        messages = messages.filter(m => m.author.id === user.id);
      }

      // Filter out messages older than 14 days (Discord limitation)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      messages = messages.filter(m => m.createdTimestamp > twoWeeksAgo);

      const deleted = await interaction.channel.bulkDelete(messages, true);

      const embed = new EmbedBuilder()
        .setColor(0x22C55E)
        .setTitle('Messages Cleared')
        .setDescription(`Successfully deleted **${deleted.size}** message(s)${user ? ` from ${user.tag}` : ''}.`)
        .setFooter({ text: `Cleared by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Clear error:', error);
      await interaction.editReply({ content: 'Failed to delete messages. Make sure they\'re not older than 14 days.'});
    }
  },
};
