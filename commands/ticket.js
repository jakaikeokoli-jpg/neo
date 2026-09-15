const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const config = require("../config");

module.exports = {

    data:

        new SlashCommandBuilder()

            .setName(
                "ticket"
            )

            .setDescription(
                "Manage the ticket system"
            )

            // =============================================
            // SETUP
            // =============================================

            .addSubcommand(
                subcommand =>
                    subcommand

                        .setName(
                            "setup"
                        )

                        .setDescription(
                            "Create the ticket panel"
                        )
            )

            // =============================================
            // CLOSE
            // =============================================

            .addSubcommand(
                subcommand =>
                    subcommand

                        .setName(
                            "close"
                        )

                        .setDescription(
                            "Close the current ticket"
                        )
            )

            // =============================================
            // OPEN
            // =============================================

            .addSubcommand(
                subcommand =>
                    subcommand

                        .setName(
                            "open"
                        )

                        .setDescription(
                            "Reopen the current ticket"
                        )
            ),

    async execute(interaction) {

        const subcommand =
            interaction.options.getSubcommand();

        // =================================================
        // SETUP
        // =================================================

        if (
            subcommand ===
            "setup"
        ) {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.Administrator
                )
            ) {

                return interaction.reply({

                    content:
                        "You do not have permission to use this command.",

                    ephemeral: true
                });
            }

            const embed =
                new EmbedBuilder()

                    .setColor(
                        config.embedColor
                    )

                    .setTitle(
                        "TXRP SUPPORT CENTER"
                    )

                    .setDescription(

                        "Welcome to the **TXRP Support Center**.\n\n" +

                        "Our support team is available to assist you " +
                        "with questions, concerns, applications and " +
                        "other server-related matters.\n\n" +

                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +

                        "**GENERAL**\n" +
                        "General questions, assistance and inquiries.\n\n" +

                        "**MANAGEMENT**\n" +
                        "Management-related matters and concerns.\n\n" +

                        "**PARTNERSHIP SUPPORT**\n" +
                        "Partnership and collaboration inquiries.\n\n" +

                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +

                        "Select the category that best matches your " +
                        "request using the menu below."
                    )

                    .setFooter({

                        text:
                            "TXRP Support • Please select the appropriate category"
                    })

                    .setTimestamp();

            if (
                config.ticketImage &&
                config.ticketImage !==
                    "YOUR_IMAGE_URL_HERE"
            ) {

                embed.setImage(
                    config.ticketImage
                );
            }

            const {
                ActionRowBuilder,
                StringSelectMenuBuilder
            } = require("discord.js");

            const menu =
                new StringSelectMenuBuilder()

                    .setCustomId(
                        "ticket_type"
                    )

                    .setPlaceholder(
                        "Select a ticket category"
                    )

                    .addOptions(

                        {
                            label:
                                "General",

                            description:
                                "General questions and assistance.",

                            value:
                                "general"
                        },

                        {
                            label:
                                "Management",

                            description:
                                "Management-related matters.",

                            value:
                                "management"
                        },

                        {
                            label:
                                "Partnership Support",

                            description:
                                "Partnership and collaboration inquiries.",

                            value:
                                "partnershipSupport"
                        }
                    );

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        menu
                    );

            const channel =
                await interaction.guild.channels.fetch(
                    config.panelChannelId
                );

            if (!channel) {

                return interaction.reply({

                    content:
                        "The configured ticket panel channel could not be found.",

                    ephemeral: true
                });
            }

            await channel.send({

                embeds: [
                    embed
                ],

                components: [
                    row
                ]
            });

            return interaction.reply({

                content:
                    "The TXRP Support panel has been created.",

                ephemeral: true
            });
        }

        // =================================================
        // CLOSE COMMAND
        // =================================================

        if (
            subcommand ===
            "close"
        ) {

            const topic =
                interaction.channel.topic || "";

            if (
                !topic.includes(
                    "ticket-owner:"
                )
            ) {

                return interaction.reply({

                    content:
                        "This command can only be used inside a ticket.",

                    ephemeral: true
                });
            }

            const ticketConfig =
                Object.values(
                    config.tickets
                ).find(
                    ticket =>
                        ticket.categoryId ===
                        interaction.channel.parentId
                );

            const isStaff =

                interaction.member.roles.cache.has(
                    config.permissions.ticketSupportRoleId
                ) ||

                (
                    ticketConfig &&
                    interaction.member.roles.cache.has(
                        ticketConfig.roleId
                    )
                );

            if (!isStaff) {

                return interaction.reply({

                    content:
                        "You do not have permission to close tickets.",

                    ephemeral: true
                });
            }

            if (
                topic.includes(
                    "ticket-status:closed"
                )
            ) {

                return interaction.reply({

                    content:
                        "This ticket is already closed.",

                    ephemeral: true
                });
            }

            const confirmButton =
                new (
                    require("discord.js")
                        .ButtonBuilder
                )()

                    .setCustomId(
                        "ticket_close_confirm"
                    )

                    .setLabel(
                        "Confirm Close"
                    )

                    .setStyle(
                        require("discord.js")
                            .ButtonStyle
                            .Danger
                    );

            const cancelButton =
                new (
                    require("discord.js")
                        .ButtonBuilder
                )()

                    .setCustomId(
                        "ticket_close_cancel"
                    )

                    .setLabel(
                        "Cancel"
                    )

                    .setStyle(
                        require("discord.js")
                            .ButtonStyle
                            .Secondary
                    );

            const row =
                new (
                    require("discord.js")
                        .ActionRowBuilder
                )()
                    .addComponents(
                        confirmButton,
                        cancelButton
                    );

            const embed =
                new EmbedBuilder()

                    .setColor(
                        0xED4245
                    )

                    .setTitle(
                        "CLOSE TICKET"
                    )

                    .setDescription(
                        "Are you sure you want to close this ticket?\n\n" +
                        "The ticket will be moved to the closed tickets category."
                    );

            return interaction.reply({

                embeds: [
                    embed
                ],

                components: [
                    row
                ],

                ephemeral: true
            });
        }

        // =================================================
        // OPEN / REOPEN
        // =================================================

        if (
            subcommand ===
            "open"
        ) {

            const topic =
                interaction.channel.topic || "";

            if (
                !topic.includes(
                    "ticket-owner:"
                )
            ) {

                return interaction.reply({

                    content:
                        "This command can only be used inside a ticket.",

                    ephemeral: true
                });
            }

            // =================================================
            // STAFF CHECK
            // =================================================

            const ticketConfig =
                Object.values(
                    config.tickets
                ).find(
                    ticket =>
                        ticket.categoryId ===
                        interaction.channel.parentId
                );

            const isStaff =

                interaction.member.roles.cache.has(
                    config.permissions.ticketSupportRoleId
                ) ||

                (
                    ticketConfig &&
                    interaction.member.roles.cache.has(
                        ticketConfig.roleId
                    )
                );

            // When the ticket is in the closed category,
            // the category-specific role cannot be detected
            // from parentId, so Ticket Support can always reopen.

            const canReopen =

                interaction.member.roles.cache.has(
                    config.permissions.ticketSupportRoleId
                ) ||

                (
                    topic.includes(
                        "ticket-status:closed"
                    ) &&
                    interaction.member.permissions.has(
                        PermissionFlagsBits.ManageChannels
                    )
                );

            if (!canReopen && !isStaff) {

                return interaction.reply({

                    content:
                        "You do not have permission to reopen tickets.",

                    ephemeral: true
                });
            }

            if (
                !topic.includes(
                    "ticket-status:closed"
                )
            ) {

                return interaction.reply({

                    content:
                        "This ticket is not closed.",

                    ephemeral: true
                });
            }

            const ownerMatch =
                topic.match(
                    /ticket-owner:(\d+)/
                );

            if (!ownerMatch) {

                return interaction.reply({

                    content:
                        "The ticket owner could not be found.",

                    ephemeral: true
                });
            }

            const ownerId =
                ownerMatch[1];

            // =================================================
            // RESTORE OPEN STATUS
            // =================================================

            const newTopic =
                topic.replace(

                    "ticket-status:closed",

                    "ticket-status:open"
                );

            await interaction.channel.setTopic(
                newTopic
            );

            // =================================================
            // RENAME
            // =================================================

            if (
                interaction.channel.name.startsWith(
                    "closed-"
                )
            ) {

                await interaction.channel.setName(

                    interaction.channel.name.replace(
                        "closed-",
                        ""
                    )
                );
            }

            // =================================================
            // MOVE BACK TO ORIGINAL CATEGORY
            // =================================================

            const originalCategory =
                Object.values(
                    config.tickets
                ).find(
                    ticket => {

                        // Determine ticket type from channel name
                        const name =
                            interaction.channel.name
                                .toLowerCase();

                        if (
                            name.startsWith(
                                "general-"
                            ) &&
                            ticket ===
                                config.tickets.general
                        ) {
                            return true;
                        }

                        if (
                            name.startsWith(
                                "management-"
                            ) &&
                            ticket ===
                                config.tickets.management
                        ) {
                            return true;
                        }

                        if (
                            name.startsWith(
                                "partnership-"
                            ) &&
                            ticket ===
                                config.tickets.partnershipSupport
                        ) {
                            return true;
                        }

                        return false;
                    }
                );

            if (originalCategory) {

                await interaction.channel.setParent(

                    originalCategory.categoryId,

                    {
                        lockPermissions:
                            false
                    }
                );
            }

            // =================================================
            // RESTORE CREATOR PERMISSIONS
            // =================================================

            await interaction.channel.permissionOverwrites.edit(

                ownerId,

                {
                    ViewChannel:
                        true,

                    ReadMessageHistory:
                        true,

                    SendMessages:
                        false
                }
            );

            // =================================================
            // ENABLE BUTTONS
            // =================================================

            const messages =
                await interaction.channel.messages.fetch({

                    limit:
                        30
                });

            const botMessage =
                messages.find(

                    message =>

                        message.author.id ===
                            interaction.client.user.id &&

                        message.components.length >
                            0
                );

            if (botMessage) {

                const enabledRows =
                    botMessage.components.map(

                        row => {

                            const newRow =
                                new (
                                    require("discord.js")
                                        .ActionRowBuilder
                                )();

                            for (
                                const component
                                of row.components
                            ) {

                                newRow.addComponents(

                                    require("discord.js")
                                        .ButtonBuilder
                                        .from(component)
                                        .setDisabled(false)
                                );
                            }

                            return newRow;
                        }
                    );

                await botMessage.edit({

                    components:
                        enabledRows
                });
            }

            await interaction.channel.send({

                embeds: [

                    new EmbedBuilder()

                        .setColor(
                            config.embedColor
                        )

                        .setTitle(
                            "TICKET REOPENED"
                        )

                        .setDescription(

                            `${interaction.user} has reopened this ticket.\n\n` +

                            "The ticket has been moved back to its original category.\n\n" +

                            "**Status:** Open"
                        )

                        .setFooter({

                            text:
                                "TXRP Ticket System"
                        })

                        .setTimestamp()
                ]
            });

            return interaction.reply({

                content:
                    "Ticket reopened successfully.",

                ephemeral: true
            });
        }
    }
};