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
    if (msg.includes(`${commandIndicator} `) || msg.includes(` ${commandIndicator}`)) {
        return false;
    }

    return msg && msg.substring(0, commandIndicator.length) === commandIndicator && msg.length > commandIndicator.length;
}

function getCommand(msg) {
    return msg.substring(commandIndicator.length).split(' ');
}

function getCommandsList() {
    return '***FAB Commands:***\n\n'
    + `**${commandIndicator}frontpage** - *find a random image from the front page. (Takes into account channel NSFW flag)*\n\n`
    + `**${commandIndicator}browse** *<all | babyfur | bondage | digimon | fatfurs | fetishother | fursuit | gore | hyper | inflation | macro | mylittlepony | paw | pokemon | pregnancy | sonic | transformation | vore | watersports | general>* - *find a random image in the browse section for type. (Takes into account channel NSFW flag)*\n\n`
    + `**${commandIndicator}random** *<username>* - *find a random image from a user's gallery.* (Only works in NSFW channels)\n\n`
    + `**${commandIndicator}search** *<tags>* - *find a random image based on tags (space separated). (Takes into account channel NSFW flag)*\n\n`
    + `**${commandIndicator}stats** *<username>* - *find stats for a user.*\n\n`;
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
    const nsfw = msg.channel.nsfw;
    if (!isBotCommand(message))
        return;

    const cmd = getCommand(message);
    switch (cmd.shift()) {
        case 'help':
            msg.author.sendMessage(getCommandsList());
            break;
        case 'browse':
            if (cmd.length > 0) {
                handler.browse(cmd[0], nsfw, (err, res) => {
                    msg.reply(err ? err : res);
                });
            } else {
                msg.reply('Please provide a type.');
            }
            break;
        case 'frontpage':
            handler.browse('all', nsfw, (err, res) => {
                msg.reply(err ? err : res);
            });
            break;
        case 'random':
            if (cmd.length > 0 && nsfw) {
                handler.randomImage(cmd[0], (err, res) => {
                    msg.reply(err ? err : res);
                });
            } else if (!nsfw) {
              msg.reply('Command can only be used in a NSFW channel.');
            } else {
                msg.reply('Please provide a username.');
            }
            break;
        case 'search':
            if (cmd.length > 0) {
                handler.tagSearch(cmd, nsfw, (err, res) => {
                    msg.reply(err ? err : res);
                });
            } else {
                msg.reply('Please provide tag(s) separated by a space.')
            }
            break;
        case 'stats':
            if (cmd.length > 0) {
                handler.userStats(cmd[0], (err, res) => {
                    msg.reply(err ? err : res);
                });
            } else {
                msg.reply('Please provide a username.')
            }
            break;
        default:
            msg.reply(`Unknown command: type *${commandIndicator}help* for a list of commands.`);
    }
});

client.login(process.env.token);

// server just to satisfy zeit/now
const server = http.createServer();
server.listen(3000);
