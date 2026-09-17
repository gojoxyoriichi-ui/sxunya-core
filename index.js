const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// Express Server for 24/7 Uptime
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Bot is live and running!'));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

// Load Clans
let clans = {};
if (fs.existsSync('clans.json')) {
    clans = JSON.parse(fs.readFileSync('clans.json', 'utf8'));
}
function saveClans() {
    fs.writeFileSync('clans.json', JSON.stringify(clans, null, 2));
}

const PREFIX = '!';

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- FUN & GENERAL COMMANDS ---
    if (command === 'ping') {
        return message.reply(`🏓 Pong! Latency is ${Date.now() - message.createdTimestamp}ms. API Latency is ${Math.round(client.ws.ping)}ms.`);
    }

    if (command === 'hug') {
        const target = message.mentions.users.first() || args.join(' ');
        if (!target) return message.reply('Mention someone to hug!');
        return message.channel.send(`🤗 ${message.author} gave ${target} a warm hug!`);
    }

    if (command === 'slap') {
        const target = message.mentions.users.first() || args.join(' ');
        if (!target) return message.reply('Mention someone to slap!');
        return message.channel.send(`🖐️ ${message.author} slapped ${target}! Ouch!`);
    }

    if (command === 'pat') {
        const target = message.mentions.users.first() || args.join(' ');
        if (!target) return message.reply('Mention someone to pat!');
        return message.channel.send(`🫳 ${message.author} gently patted ${target} on the head!`);
    }

    // --- COMPLETE HELP COMMAND ---
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('📜 Sxunya Core Command List')
            .setColor('#5865F2')
            .setDescription('Here are all the available commands for the server:')
            .addFields(
                { 
                    name: '🎮 General & Fun', 
                    value: '`!ping` - Check bot latency\n`!hug <@user>` - Hug someone\n`!slap <@user>` - Slap someone\n`!pat <@user>` - Pat someone on the head' 
                },
                { 
                    name: '🛡️ Clan System', 
                    value: '`!createclan <name>` - Create a new clan\n`!joinclan <name>` - Join an existing clan\n`!leaveclan` - Leave your current clan\n`!claninfo [name]` - View clan details\n`!clandelete <name>` - Delete a clan (Admin)' 
                }
            )
            .setFooter({ text: 'Use ! prefix before every command.' });

        return message.channel.send({ embeds: [helpEmbed] });
    }

    // --- CLAN COMMANDS ---
    if (command === 'createclan') {
        const clanName = args.join(' ');
        if (!clanName) return message.reply('Please provide a clan name!');
        if (clans[clanName]) return message.reply('A clan with that name already exists!');

        clans[clanName] = { owner: message.author.id, members: [message.author.id] };
        saveClans();
        return message.reply(`✅ Clan **${clanName}** successfully created!`);
    }

    if (command === 'joinclan') {
        const searchName = args.join(' ').toLowerCase();
        if (!searchName) return message.reply('Please specify a clan to join!');

        const match = Object.keys(clans).find(c => c.toLowerCase() === searchName);
        if (!match) return message.reply('Clan not found!');

        if (clans[match].members.includes(message.author.id)) {
            return message.reply('You are already in this clan!');
        }

        clans[match].members.push(message.author.id);
        saveClans();
        return message.reply(`🎉 You joined **${match}**!`);
    }

    if (command === 'leaveclan') {
        let leftClan = null;
        for (const [name, data] of Object.entries(clans)) {
            if (data.members.includes(message.author.id)) {
                data.members = data.members.filter(id => id !== message.author.id);
                leftClan = name;
                break;
            }
        }
        if (!leftClan) return message.reply('You are not in any clan!');
        saveClans();
        return message.reply(`🚪 You left **${leftClan}**.`);
    }

    if (command === 'claninfo') {
        const searchName = args.join(' ');
        let targetClan = searchName;

        if (!targetClan) {
            for (const [name, data] of Object.entries(clans)) {
                if (data.members.includes(message.author.id)) {
                    targetClan = name;
                    break;
                }
            }
        }

        if (!targetClan || !clans[targetClan]) return message.reply('Clan not found or you are not in one!');

        const data = clans[targetClan];
        const embed = new EmbedBuilder()
            .setTitle(`🛡️ Clan: ${targetClan}`)
            .setColor('#FFD700')
            .addFields(
                { name: 'Owner', value: `<@${data.owner}>`, inline: true },
                { name: 'Total Members', value: `${data.members.length}`, inline: true },
                { name: 'Members', value: data.members.map(id => `<@${id}>`).join(', ') }
            );

        return message.channel.send({ embeds: [embed] });
    }

    if (command === 'clandelete') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('Only server administrators can delete clans!');
        }
        const clanName = args.join(' ');
        if (!clans[clanName]) return message.reply('Clan does not exist!');

        delete clans[clanName];
        saveClans();
        return message.reply(`🗑️ Clan **${clanName}** has been deleted.`);
    }
});

client.login(process.env.DISCORD_TOKEN);
