require("dotenv").config();

const express = require("express");

const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const app = express();

// =====================================================
// WEB SERVER
// =====================================================

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.status(200).send("TXRP Ticket Bot is online.");
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "online",
        bot: "TXRP Ticket Bot"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Web server listening on port ${PORT}`);
});

// =====================================================
// DISCORD CLIENT
// =====================================================

const client = new Client({

    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ],

    partials: [
        Partials.Channel
    ]
});

// =====================================================
// COMMAND HANDLER
// =====================================================

client.commands = new Collection();

const commandsPath =
    path.join(
        __dirname,
        "commands"
    );

if (fs.existsSync(commandsPath)) {

    const commandFiles =
        fs.readdirSync(commandsPath)
            .filter(
                file =>
                    file.endsWith(".js")
            );

    for (const file of commandFiles) {

        const command =
            require(
                path.join(
                    commandsPath,
                    file
                )
            );

        if (
            command.data &&
            command.execute
        ) {

            client.commands.set(
                command.data.name,
                command
            );
        }
    }
}

// =====================================================
// EVENT HANDLER
// =====================================================

const eventsPath =
    path.join(
        __dirname,
        "events"
    );

if (fs.existsSync(eventsPath)) {

    const eventFiles =
        fs.readdirSync(eventsPath)
            .filter(
                file =>
                    file.endsWith(".js")
            );

    for (const file of eventFiles) {

        const event =
            require(
                path.join(
                    eventsPath,
                    file
                )
            );

        if (event.once) {

            client.once(
                event.name,
                (...args) =>
                    event.execute(
                        ...args,
                        client
                    )
            );

        } else {

            client.on(
                event.name,
                (...args) =>
                    event.execute(
                        ...args,
                        client
                    )
            );
        }
    }
}

// =====================================================
// BOT READY
// =====================================================

client.once("ready", () => {

    console.log(
        "================================="
    );

    console.log(
        `Logged in as ${client.user.tag}`
    );

    console.log(
        `Bot ID: ${client.user.id}`
    );

    console.log(
        "Ticket bot is online!"
    );

    console.log(
        `Web server: port ${PORT}`
    );

    console.log(
        "================================="
    );
});

// =====================================================
// LOGIN
// =====================================================

client.login(
    process.env.TOKEN
);