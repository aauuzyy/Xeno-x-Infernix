const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('infernix')
    .setDescription('Get information about Infernix Executor'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0xF97316)
      .setTitle('Infernix Executor')
      .setDescription('The next-generation Roblox executor with a blazing fast UI and powerful features.')
      .addFields(
        { name: 'Features', value: [
          '• Modern React + Electron UI',
          '• Script Hub with 1000+ scripts',
          '• AutoExec on game join',
          '• Custom themes & accent colors',
          '• Drag & Drop script loading',
          '• Auto-Update system',
        ].join('\n'), inline: false },
        { name: 'Powered By', value: 'Xeno API', inline: true },
        { name: 'Platform', value: 'Windows x64', inline: true },
        { name: 'Latest Version', value: 'v1.1.8', inline: true },
      )
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setFooter({ text: 'Infernix Team'})
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Download')
          .setStyle(ButtonStyle.Link)
          .setURL('https://github.com/aauuzyy/Xeno-x-Infernix/releases/latest')
          .setEmoji(''),
        new ButtonBuilder()
          .setLabel('GitHub')
          .setStyle(ButtonStyle.Link)
          .setURL('https://github.com/aauuzyy/Xeno-x-Infernix')
          .setEmoji(''),
      );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
