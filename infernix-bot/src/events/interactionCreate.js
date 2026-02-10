const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`);
        console.error(error);
        
        const errorMessage = {
          content: 'There was an error while executing this command!',
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }

    // Handle button interactions
    if (interaction.isButton()) {
      // Handle button clicks here
      console.log(`Button clicked: ${interaction.customId}`);
    }

    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
      console.log(`Select menu: ${interaction.customId}`);
    }
  },
};
