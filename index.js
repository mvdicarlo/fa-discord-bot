const http = require('http');

const Discord = require('discord.js');
const client = new Discord.Client();
const handler = require('./src/command-handler');
const commandIndicator = process.env.indicator || 'owo';
const logger = require('winston');

logger.configure({
    transports: [new(logger.transports.Console)({
        colorize: true
    })]
});

function isBotCommand(msg) {
    if (msg.includes('owo ') || msg.includes(' owo')) {
        return false;
    }

    return msg && msg.substring(0, commandIndicator.length) === commandIndicator && msg.length > commandIndicator.length;
}

function getCommand(msg) {
    return msg.substring(commandIndicator.length).split(' ');
}

function getCommandsList() {
    return 'FAB Commands:\n```' + `${commandIndicator}random <username>` + '```';
}

client.on('ready', (evt) => {
    logger.info('Connected');
    logger.info(`Logged in as: ${client.user.tag}`);

    client.user.setStatus('available')
    client.user.setPresence({
        game: {
            name: `to ${commandIndicator}help`,
            type: 'Listening'
        }
    });
});

client.on('message', (msg) => {
    const message = msg.content.trim();
    if (!isBotCommand(message))
        return;

    const cmd = getCommand(message);
    switch (cmd[0]) {
        case 'help':
            msg.author.sendMessage(getCommandsList());
            break;
        case 'random':
            if (cmd.length > 1) {
                handler.randomImage(cmd[1], (err, res) => {
                    msg.reply(err ? err : res);
                });
            } else {
                msg.reply('Please provide a username.');
            }
            break;
        default:
            msg.reply(`Unknown command: type ${commandIndicator}help for a list of commands`);
    }
});

client.login(process.env.token);

// server just to satisfy zeit/now
const server = http.createServer();
server.listen(3000);
