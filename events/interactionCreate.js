const {
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
} = require("discord.js");

const config = require("../config");

// =====================================================
// GET TICKET CONFIG
// =====================================================

function getTicketConfig(type) {
  return config.tickets[type] || null;
}

// =====================================================
// GET TICKET TYPE
// =====================================================

function getTicketType(channel) {
  const topic = channel.topic || "";

  const match = topic.match(/ticket-type:([a-zA-Z]+)/);

  if (!match) {
    return null;
  }

  return match[1];
}

// =====================================================
// CHECK TICKET STAFF
// =====================================================

function isTicketStaff(member, ticketConfig) {
  if (member.roles.cache.has(config.permissions.ticketSupportRoleId)) {
    return true;
  }

  if (ticketConfig && member.roles.cache.has(ticketConfig.roleId)) {
    return true;
  }

  return false;
}

// =====================================================
// GET TICKET OWNER
// =====================================================

function getTicketOwnerId(channel) {
  const topic = channel.topic || "";

  const match = topic.match(/ticket-owner:(\d+)/);

  return match ? match[1] : null;
}

// =====================================================
// GET TICKET CLAIMER
// =====================================================

function getTicketClaimerId(channel) {
  const topic = channel.topic || "";

  const match = topic.match(/ticket-claimer:(\d+)/);

  return match ? match[1] : null;
}

// =====================================================
// GET TICKET MESSAGES
// =====================================================

async function getAllMessages(channel) {
  const messages = [];

  let lastId = null;

  while (true) {
    const options = {
      limit: 100,
    };

    if (lastId) {
      options.before = lastId;
    }

    const batch = await channel.messages.fetch(options);

    if (!batch.size) {
      break;
    }

    messages.push(...batch.values());

    lastId = batch.last().id;

    if (batch.size < 100) {
      break;
    }
  }

  return messages.reverse();
}

// =====================================================
// CREATE TRANSCRIPT
// =====================================================

async function createTranscript(channel, messages) {
  let transcript = "";

  transcript += "========================================\n";

  transcript += "TXRP TICKET TRANSCRIPT\n";

  transcript += "========================================\n\n";

  transcript += `Channel: #${channel.name}\n`;

  transcript += `Channel ID: ${channel.id}\n`;

  transcript += `Created: ${
    channel.createdAt ? channel.createdAt.toISOString() : "Unknown"
  }\n`;

  transcript += `Generated: ${new Date().toISOString()}\n`;

  transcript += `Messages: ${messages.length}\n\n`;

  transcript += "========================================\n\n";

  for (const message of messages) {
    const timestamp = message.createdAt
      ? message.createdAt.toISOString()
      : "Unknown";

    const author = message.author
      ? `${message.author.tag} (${message.author.id})`
      : "Unknown User";

    transcript += `[${timestamp}] ${author}\n`;

    if (message.content) {
      transcript += `${message.content}\n`;
    }

    if (message.attachments.size) {
      transcript += "Attachments:\n";

      for (const attachment of message.attachments.values()) {
        transcript += `${attachment.url}\n`;
      }
    }

    if (message.embeds.length) {
      transcript += `[${message.embeds.length} embed(s)]\n`;
    }

    transcript += "\n----------------------------------------\n\n";
  }

  transcript += "========================================\n";

  transcript += "END OF TRANSCRIPT\n";

  transcript += "========================================\n";

  return Buffer.from(transcript, "utf8");
}

// =====================================================
// INTERACTION CREATE
// =====================================================

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    // =================================================
    // SLASH COMMANDS
    // =================================================

    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error("Command error:", error);

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "An error occurred while executing this command.",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: "An error occurred while executing this command.",
            ephemeral: true,
          });
        }
      }

      return;
    }

    // =================================================
    // TICKET TYPE DROPDOWN
    // =================================================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_type"
    ) {
      const ticketType = interaction.values[0];

      const ticketConfig = getTicketConfig(ticketType);

      if (!ticketConfig) {
        return interaction.reply({
          content: "This ticket category is not configured correctly.",
          ephemeral: true,
        });
      }

      // ---------------------------------------------
      // CHECK EXISTING OPEN TICKET
      // ---------------------------------------------

      const existingTicket = interaction.guild.channels.cache.find(
        (channel) => {
          if (channel.type !== ChannelType.GuildText) {
            return false;
          }

          const topic = channel.topic || "";

          if (!topic.includes(`ticket-owner:${interaction.user.id}`)) {
            return false;
          }

          if (topic.includes("ticket-status:closed")) {
            return false;
          }

          return topic.includes("ticket-status:open");
        },
      );

      if (existingTicket) {
        return interaction.reply({
          content: `You already have an open ticket: ${existingTicket}`,
          ephemeral: true,
        });
      }

      // ---------------------------------------------
      // REASON MODAL
      // ---------------------------------------------

      const modal = new ModalBuilder()
        .setCustomId(`ticket_reason_${ticketType}`)
        .setTitle("Ticket Reason");

      const reasonInput = new TextInputBuilder()
        .setCustomId("ticket_reason_input")
        .setLabel("Why are you opening this ticket?")
        .setPlaceholder("Please explain your reason...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

      await interaction.showModal(modal);

      return;
    }

    // =================================================
    // TICKET REASON MODAL
    // =================================================

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("ticket_reason_")
    ) {
      const ticketType = interaction.customId.replace("ticket_reason_", "");

      const ticketConfig = getTicketConfig(ticketType);

      if (!ticketConfig) {
        return interaction.reply({
          content: "This ticket category is not configured correctly.",
          ephemeral: true,
        });
      }

      const reason = interaction.fields.getTextInputValue(
        "ticket_reason_input",
      );

      // ---------------------------------------------
      // CHECK EXISTING TICKET AGAIN
      // ---------------------------------------------

      const existingTicket = interaction.guild.channels.cache.find(
        (channel) => {
          if (channel.type !== ChannelType.GuildText) {
            return false;
          }

          const topic = channel.topic || "";

          if (!topic.includes(`ticket-owner:${interaction.user.id}`)) {
            return false;
          }

          if (topic.includes("ticket-status:closed")) {
            return false;
          }

          return topic.includes("ticket-status:open");
        },
      );

      if (existingTicket) {
        return interaction.reply({
          content: `You already have an open ticket: ${existingTicket}`,
          ephemeral: true,
        });
      }

      // ---------------------------------------------
      // TICKET NAME
      // ---------------------------------------------

      const username = interaction.user.username
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 15);

      const channelName = `${ticketType}-${username}`.slice(0, 100);

      // ---------------------------------------------
      // CREATE PRIVATE TICKET
      // ---------------------------------------------

      const channel = await interaction.guild.channels.create({
        name: channelName,

        type: ChannelType.GuildText,

        parent: ticketConfig.categoryId,

        topic:
          `ticket-type:${ticketType} | ` +
          `ticket-owner:${interaction.user.id} | ` +
          `ticket-claimer:none | ` +
          `ticket-status:open | ` +
          `ticket-escalated:no`,

        permissionOverwrites: [
          // EVERYONE CANNOT SEE
          {
            id: interaction.guild.roles.everyone.id,

            deny: [PermissionFlagsBits.ViewChannel],
          },

          // CREATOR CAN SEE AND TYPE
          {
            id: interaction.user.id,

            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.SendMessages,
            ],
          },

          // CATEGORY STAFF
          {
            id: ticketConfig.roleId,

            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.SendMessages,
            ],
          },

          // GLOBAL TICKET SUPPORT
          {
            id: config.permissions.ticketSupportRoleId,

            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.SendMessages,
            ],
          },
        ],
      });

      // =================================================
      // EMBED
      // =================================================

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle("TXRP SUPPORT TICKET")
        .setDescription(
          `Welcome ${interaction.user}.\n\n` +
            "Thank you for contacting TXRP Support. " +
            "A member of the appropriate support team will assist you shortly.\n\n" +
            "**Ticket Information**\n" +
            `**Category:** ${
              ticketType === "partnershipSupport"
                ? "Partnership Support"
                : ticketType.charAt(0).toUpperCase() + ticketType.slice(1)
            }\n` +
            `**Opened By:** ${interaction.user}\n\n` +
            "**Reason**\n" +
            reason,
        )
        .setFooter({
          text: "TXRP Ticket System",
        })
        .setTimestamp();

      if (config.ticketImage && config.ticketImage !== "YOUR_IMAGE_URL_HERE") {
        embed.setImage(config.ticketImage);
      }

      // =================================================
      // BUTTONS
      // =================================================

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_claim")
          .setLabel("Claim")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("Close")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("ticket_escalate")
          .setLabel("Escalate")
          .setStyle(ButtonStyle.Secondary),
      );

      // =================================================
      // SEND TICKET MESSAGE
      // =================================================

      await channel.send({
        content: `<@&${ticketConfig.roleId}>`,

        embeds: [embed],

        components: [buttons],
      });

      return interaction.reply({
        content: `Your ticket has been created: ${channel}`,
        ephemeral: true,
      });
    }

    // =================================================
    // CLAIM
    // =================================================

    if (interaction.isButton() && interaction.customId === "ticket_claim") {
      const channel = interaction.channel;

      const topic = channel.topic || "";

      const ticketType = getTicketType(channel);

      const ticketConfig = getTicketConfig(ticketType);

      if (!isTicketStaff(interaction.member, ticketConfig)) {
        return interaction.reply({
          content: "You do not have permission to claim this ticket.",
          ephemeral: true,
        });
      }

      if (topic.includes("ticket-status:closed")) {
        return interaction.reply({
          content: "This ticket is closed.",
          ephemeral: true,
        });
      }

      if (!topic.includes("ticket-claimer:none")) {
        return interaction.reply({
          content: "This ticket has already been claimed.",
          ephemeral: true,
        });
      }

      await channel.setTopic(
        topic.replace(
          "ticket-claimer:none",
          `ticket-claimer:${interaction.user.id}`,
        ),
      );

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle("TICKET CLAIMED")
            .setDescription(`${interaction.user} has claimed this ticket.`)
            .setFooter({
              text: "TXRP Ticket System",
            })
            .setTimestamp(),
        ],
      });
    }

    // =================================================
    // ESCALATE
    // =================================================

    if (interaction.isButton() && interaction.customId === "ticket_escalate") {
      const channel = interaction.channel;

      const topic = channel.topic || "";

      if (topic.includes("ticket-status:closed")) {
        return interaction.reply({
          content: "You cannot escalate a closed ticket.",
          ephemeral: true,
        });
      }

      if (
        !interaction.member.roles.cache.has(
          config.permissions.ticketSupportRoleId,
        )
      ) {
        return interaction.reply({
          content: "Only Ticket Support can escalate tickets.",
          ephemeral: true,
        });
      }

      if (topic.includes("ticket-escalated:yes")) {
        return interaction.reply({
          content: "This ticket has already been escalated.",
          ephemeral: true,
        });
      }

      await channel.setTopic(
        topic.replace("ticket-escalated:no", "ticket-escalated:yes"),
      );

      return interaction.reply({
        content: `<@&${config.permissions.escalateRoleId}>`,

        embeds: [
          new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle("TICKET ESCALATED")
            .setDescription(`${interaction.user} has escalated this ticket.`)
            .setFooter({
              text: "TXRP Ticket System",
            })
            .setTimestamp(),
        ],
      });
    }

    // =================================================
    // CLOSE BUTTON
    // =================================================

    if (interaction.isButton() && interaction.customId === "ticket_close") {
      const channel = interaction.channel;

      const topic = channel.topic || "";

      const ticketType = getTicketType(channel);

      const ticketConfig = getTicketConfig(ticketType);

      if (!isTicketStaff(interaction.member, ticketConfig)) {
        return interaction.reply({
          content: "You do not have permission to close this ticket.",
          ephemeral: true,
        });
      }

      const confirm = new ButtonBuilder()
        .setCustomId("ticket_close_confirm")
        .setLabel("Confirm Close")
        .setStyle(ButtonStyle.Danger);

      const cancel = new ButtonBuilder()
        .setCustomId("ticket_close_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("CLOSE TICKET")
            .setDescription(
              "Are you sure you want to close this ticket?\n\n" +
                "The ticket will be permanently deleted after the transcript is saved.",
            ),
        ],

        components: [new ActionRowBuilder().addComponents(confirm, cancel)],

        ephemeral: true,
      });
    }

    // =================================================
    // CANCEL CLOSE
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_close_cancel"
    ) {
      return interaction.update({
        content: "Ticket closure cancelled.",

        embeds: [],

        components: [],
      });
    }

    // =================================================
    // CONFIRM CLOSE
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_close_confirm"
    ) {
      const channel = interaction.channel;

      const topic = channel.topic || "";

      const ticketType = getTicketType(channel);

      const ticketConfig = getTicketConfig(ticketType);

      if (!isTicketStaff(interaction.member, ticketConfig)) {
        return interaction.update({
          content: "You do not have permission to close this ticket.",

          embeds: [],

          components: [],
        });
      }

      const ownerId = getTicketOwnerId(channel);

      if (!ownerId) {
        return interaction.update({
          content: "Could not find the ticket owner.",

          embeds: [],

          components: [],
        });
      }

      // ---------------------------------------------
      // COLLECT MESSAGES
      // ---------------------------------------------

      let messages;

      try {
        messages = await getAllMessages(channel);
      } catch (error) {
        console.error("Transcript collection error:", error);

        return interaction.update({
          content:
            "I could not collect the transcript, so the ticket was NOT deleted.",

          embeds: [],

          components: [],
        });
      }

      // ---------------------------------------------
      // CREATE TRANSCRIPT
      // ---------------------------------------------

      let transcriptBuffer;

      try {
        transcriptBuffer = await createTranscript(channel, messages);
      } catch (error) {
        console.error("Transcript creation error:", error);

        return interaction.update({
          content:
            "I could not create the transcript, so the ticket was NOT deleted.",

          embeds: [],

          components: [],
        });
      }

      // ---------------------------------------------
      // GET TRANSCRIPT CHANNEL
      // ---------------------------------------------

      const transcriptChannel = await interaction.guild.channels
        .fetch(config.transcriptChannelId)
        .catch(() => null);

      if (!transcriptChannel) {
        return interaction.update({
          content:
            "The transcript channel could not be found. The ticket was NOT deleted.",

          embeds: [],

          components: [],
        });
      }

      // ---------------------------------------------
      // SEND TRANSCRIPT
      // ---------------------------------------------

      try {
        const transcriptAttachment = new AttachmentBuilder(transcriptBuffer, {
          name: `${channel.name}-transcript.txt`,
        });

        const owner = await interaction.client.users
          .fetch(ownerId)
          .catch(() => null);

        const claimerId = getTicketClaimerId(channel);

        const claimer = claimerId
          ? await interaction.client.users.fetch(claimerId).catch(() => null)
          : null;

        const transcriptEmbed = new EmbedBuilder()
          .setColor(config.embedColor)
          .setTitle("TICKET TRANSCRIPT")
          .setDescription(`A ticket has been closed by ${interaction.user}.`)
          .addFields(
            {
              name: "Ticket",
              value: `#${channel.name}`,
              inline: true,
            },

            {
              name: "Type",
              value: ticketType || "Unknown",
              inline: true,
            },

            {
              name: "Ticket Owner",
              value: owner ? `${owner} (${owner.tag})` : ownerId,
              inline: false,
            },

            {
              name: "Closed By",
              value: `${interaction.user}`,
              inline: false,
            },

            {
              name: "Claimed By",
              value: claimer ? `${claimer}` : "Unclaimed",
              inline: false,
            },

            {
              name: "Messages",
              value: `${messages.length}`,
              inline: true,
            },
          )
          .setFooter({
            text: "TXRP Ticket System",
          })
          .setTimestamp();

        await transcriptChannel.send({
          embeds: [transcriptEmbed],

          files: [transcriptAttachment],
        });
      } catch (error) {
        console.error("Transcript send error:", error);

        return interaction.update({
          content:
            "I could not send the transcript. The ticket was NOT deleted.",

          embeds: [],

          components: [],
        });
      }

      // ---------------------------------------------
      // DM TICKET OWNER
      // ---------------------------------------------

      try {
        const owner = await interaction.client.users.fetch(ownerId);

        await owner.send({
          embeds: [
            new EmbedBuilder()
              .setColor(config.embedColor)
              .setTitle("TICKET CLOSED")
              .setDescription(
                `Your TXRP support ticket has been closed by ${interaction.user}.\n\n` +
                  "Thank you for contacting TXRP Support.\n\n" +
                  "**Status:** Closed",
              )
              .setFooter({
                text: "TXRP Ticket System",
              })
              .setTimestamp(),
          ],
        });
      } catch (error) {
        // User may have DMs disabled.
        console.log(`Could not DM ticket owner ${ownerId}:`, error.message);
      }

      // ---------------------------------------------
      // TELL STAFF
      // ---------------------------------------------

      await interaction.update({
        content:
          "Transcript saved and ticket owner notified. Deleting ticket...",

        embeds: [],

        components: [],
      });

      // ---------------------------------------------
      // DELETE CHANNEL
      // ---------------------------------------------

      setTimeout(async () => {
        try {
          await channel.delete("Ticket closed - transcript saved");
        } catch (error) {
          console.error("Ticket deletion error:", error);
        }
      }, 3000);

      return;
    }
  },
};
