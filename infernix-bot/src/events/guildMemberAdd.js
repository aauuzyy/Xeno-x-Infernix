const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
    if (!welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(welcomeChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0xF97316)
      .setTitle('Welcome to Infernix!')
      .setDescription(`Hey ${member}, welcome to the **Infernix** community!\n\nMake sure to read the rules and enjoy your stay!`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: 'Member', value: member.user.tag, inline: true },
        { name: 'Member #', value: `${member.guild.memberCount}`, inline: true },
      )
      .setFooter({ text: 'Infernix Community'})
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    // Auto-assign member role if configured
    const memberRoleId = process.env.MEMBER_ROLE_ID;
    if (memberRoleId) {
      try {
        await member.roles.add(memberRoleId);
      } catch (error) {
        console.error('Failed to assign member role:', error);
      }
    }
  },
};
