const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all commands'),

  async execute(interaction) {
    const commands = interaction.client.commands;

    const embed = new EmbedBuilder()
      .setColor(0xF97316)
      .setTitle('Infernix Bot Commands')
      .setDescription('Here are all available commands:')
      .addFields(
        { 
          name: 'General', 
          value: [
            '`/ping` - Check bot latency',
            '`/infernix` - Info about Infernix Executor',
            '`/serverinfo` - Server information',
            '`/userinfo` - User information',
            '`/help` - Show this help menu',
          ].join('\n'),
          inline: false,
        },
        { 
          name: 'Announcements', 
          value: [
            '`/announce` - Send an announcement',
            '`/webhook` - Send a webhook message',
          ].join('\n'),
          inline: false,
        },
        { 
          name: 'Moderation', 
          value: [
            '`/kick` - Kick a member',
            '`/ban` - Ban a member',
            '`/timeout` - Timeout (mute) a member',
            '`/warn` - Warn a member',
            '`/clear` - Delete messages',
          ].join('\n'),
          inline: false,
        },
      )
      .setFooter({ text: 'Infernix Bot'})
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
