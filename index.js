const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    PermissionsBitField, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits 
} = require('discord.js');
const express = require('express');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Express Server for 24/7 Uptime
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Sxunya Core Bot is online and operational!'));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

// Load Data
let clans = {};
let economy = {}; 
let settings = {}; 

if (fs.existsSync('clans.json')) {
    clans = JSON.parse(fs.readFileSync('clans.json', 'utf8'));
}
if (fs.existsSync('economy.json')) {
    economy = JSON.parse(fs.readFileSync('economy.json', 'utf8'));
}
if (fs.existsSync('settings.json')) {
    settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
}

function saveData() {
    fs.writeFileSync('clans.json', JSON.stringify(clans, null, 2));
    fs.writeFileSync('economy.json', JSON.stringify(economy, null, 2));
    fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2));
}

function getUserData(userId) {
    if (!economy[userId]) {
        economy[userId] = { balance: 100, lastDaily: 0 };
    }
    return economy[userId];
}

function getGuildSettings(guildId) {
    if (!settings[guildId]) {
        settings[guildId] = { autoRoleEnabled: false };
    }
    return settings[guildId];
}

const PREFIX = '!';

// ==========================================
// 🎟️ TICKET BUTTON INTERACTION HANDLER
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // Handle "Create Ticket" Button Click
    if (interaction.customId === 'create_ticket') {
        const ticketChannelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        
        // Check if user already has an open ticket
        const existingChannel = interaction.guild.channels.cache.find(c => c.name === ticketChannelName);
        if (existingChannel) {
            return interaction.reply({ content: `❌ You already have an open ticket: ${existingChannel}`, ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Create private ticket channel
            const ticketChannel = await interaction.guild.channels.create({
                name: ticketChannelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id, // @everyone role
                        deny: [PermissionFlagsBits.ViewChannel], // Hide from everyone
                    },
                    {
                        id: interaction.user.id, // Ticket Creator
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
                    },
                    {
                        id: client.user.id, // Bot itself
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                    }
                ],
            });

            const welcomeTicketEmbed = new EmbedBuilder()
                .setTitle(`🎟️ Ticket Support`)
                .setDescription(`Hello <@${interaction.user.id}>! Thank you for opening a ticket.\nPlease describe your issue or question below and a staff member will assist you shortly.`)
                .setColor('#5865F2')
                .setFooter({ text: 'Click the button below when your issue is resolved.' });

            const closeButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('🔒 Close Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [welcomeTicketEmbed], components: [closeButton] });
            return interaction.editReply({ content: `✅ Ticket created! Check out your channel: ${ticketChannel}` });

        } catch (error) {
            console.error('Error creating ticket channel:', error);
            return interaction.editReply({ content: '❌ Failed to create ticket channel. Please make sure the bot has **Manage Channels** permissions!' });
        }
    }

    // Handle "Close Ticket" Button Click
    if (interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 Closing and deleting this ticket in 5 seconds...');
        setTimeout(() => {
            interaction.channel.delete().catch(err => console.log('Could not delete ticket channel:', err));
        }, 5000);
    }
});

// --- EVENT: AUTO-WELCOME & TOGGLABLE AUTO-ROLE ---
client.on('guildMemberAdd', async (member) => {
    const guildSettings = getGuildSettings(member.guild.id);

    if (guildSettings.autoRoleEnabled) {
        const role = member.guild.roles.cache.find(r => r.name === 'Member');
        if (role) {
            await member.roles.add(role).catch(err => console.log('Could not add auto-role:', err));
        }
    }

    const channel = member.guild.systemChannel || member.guild.channels.cache.find(ch => ch.name.includes('welcome') || ch.name.includes('general'));
    if (channel) {
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`🎉 Welcome to ${member.guild.name}!`)
            .setDescription(`Welcome <@${member.id}>! We're glad to have you here. Use \`!help\` to check out all bot commands!`)
            .setColor('#5865F2')
            .setThumbnail(member.user.displayAvatarURL());
        
        channel.send({ embeds: [welcomeEmbed] });
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const userEco = getUserData(message.author.id);
    const guildSettings = message.guild ? getGuildSettings(message.guild.id) : null;

    // ==========================================
    // 🎟️ TICKET SETUP COMMAND (ADMIN ONLY)
    // ==========================================
    if (command === 'setup-ticket') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Only server administrators can setup the ticket system!');
        }

        const ticketEmbed = new EmbedBuilder()
            .setTitle('📩 Support Ticket Panel')
            .setDescription('Need help, have a question, or need to contact staff?\nClick the button below to open a private support ticket!')
            .setColor('#3498DB');

        const ticketRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('📩 Create Ticket')
                .setStyle(ButtonStyle.Primary)
        );

        await message.channel.send({ embeds: [ticketEmbed], components: [ticketRow] });
        return message.delete().catch(() => {});
    }

    // ==========================================
    // ⚙️ TOGGLABLE AUTO-ROLE COMMANDS (ADMIN)
    // ==========================================
    if (command === 'enableautoroles') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Only server administrators can use this command!');
        }

        guildSettings.autoRoleEnabled = true;
        saveData();
        return message.reply('✅ Auto-roles have been **enabled**! New members will automatically receive the "Member" role.');
    }

    if (command === 'disableautoroles') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Only server administrators can use this command!');
        }

        guildSettings.autoRoleEnabled = false;
        saveData();
        return message.reply('🛑 Auto-roles have been **disabled**.');
    }

    // ==========================================
    // 📊 COMMUNITY POLL COMMAND (ADMIN ONLY)
    // ==========================================
    if (command === 'poll') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Only server administrators can create polls!');
        }

        const question = args.join(' ');
        if (!question) return message.reply('Please provide a question for the poll!');

        const pollEmbed = new EmbedBuilder()
            .setTitle('📊 Official Server Poll')
            .setDescription(question)
            .setColor('#F1C40F')
            .setFooter({ text: `Created by Administrator ${message.author.username}` });

        const pollMessage = await message.channel.send({ embeds: [pollEmbed] });
        await pollMessage.react('👍');
        await pollMessage.react('👎');
        return;
    }

    // ==========================================
    // 🎮 GENERAL & FUN COMMANDS
    // ==========================================
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

    // ==========================================
    // 💋 SOCIAL & INTERACTION COMMANDS
    // ==========================================
    if (command === 'kiss') {
        const target = message.mentions.users.first() || args.join(' ');
        if (!target) return message.reply('Mention someone to kiss!');
        return message.channel.send(`💋 ${message.author} kissed ${target}!`);
    }

    if (command === 'poke') {
        const target = message.mentions.users.first() || args.join(' ');
        if (!target) return message.reply('Mention someone to poke!');
        return message.channel.send(`👉 ${message.author} poked ${target}!`);
    }

    if (command === 'cuddle') {
        const target = message.mentions.users.first() || args.join(' ');
        if (!target) return message.reply('Mention someone to cuddle!');
        return message.channel.send(`🫂 ${message.author} cuddled up next to ${target}!`);
    }

    if (command === 'profile') {
        const targetUser = message.mentions.users.first() || message.author;
        const targetEco = getUserData(targetUser.id);
        
        let userClan = 'None';
        for (const [name, data] of Object.entries(clans)) {
            if (data.members.includes(targetUser.id)) {
                userClan = name;
                break;
            }
        }

        const profileEmbed = new EmbedBuilder()
            .setTitle(`👤 Profile: ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL())
            .setColor('#3498DB')
            .addFields(
                { name: '💰 Wallet Balance', value: `${targetEco.balance} coins`, inline: true },
                { name: '🛡️ Clan', value: userClan, inline: true },
                { name: '📅 Joined Server', value: `<t:${Math.floor(message.guild.members.cache.get(targetUser.id)?.joinedTimestamp / 1000)}:R>`, inline: false }
            );

        return message.channel.send({ embeds: [profileEmbed] });
    }

    // ==========================================
    // 💰 ECONOMY & MINIGAMES
    // ==========================================
    if (command === 'daily') {
        const cooldown = 24 * 60 * 60 * 1000;
        const now = Date.now();

        if (now - userEco.lastDaily < cooldown) {
            const timeLeft = cooldown - (now - userEco.lastDaily);
            const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            return message.reply(`⌛ You already collected your daily reward! Come back in **${hoursLeft}h ${minutesLeft}m**.`);
        }

        const reward = 250;
        userEco.balance += reward;
        userEco.lastDaily = now;
        saveData();

        return message.reply(`🪙 You collected your daily reward of **${reward} coins**! Current Balance: **${userEco.balance} coins**.`);
    }

    if (command === 'balance' || command === 'bal') {
        const targetUser = message.mentions.users.first() || message.author;
        const targetEco = getUserData(targetUser.id);
        return message.reply(`💰 **${targetUser.username}**'s Balance: **${targetEco.balance} coins**.`);
    }

    if (command === 'coinflip') {
        const choice = args[0]?.toLowerCase();
        const bet = parseInt(args[1]);

        if (!choice || !['heads', 'tails'].includes(choice)) {
            return message.reply('Usage: `!coinflip <heads/tails> <amount>`');
        }
        if (isNaN(bet) || bet <= 0) {
            return message.reply('Please specify a valid bet amount!');
        }
        if (bet > userEco.balance) {
            return message.reply('You do not have enough coins to place that bet!');
        }

        const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
        if (choice === outcome) {
            userEco.balance += bet;
            saveData();
            return message.reply(`🪙 The coin landed on **${outcome}**! You won **${bet} coins**! New Balance: **${userEco.balance} coins**.`);
        } else {
            userEco.balance -= bet;
            saveData();
            return message.reply(`🪙 The coin landed on **${outcome}**! You lost **${bet} coins**. New Balance: **${userEco.balance} coins**.`);
        }
    }

    if (command === 'givemoney' || command === 'pay') {
        const targetUser = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!targetUser) {
            return message.reply('Usage: `!givemoney @user <amount>`');
        }
        if (targetUser.id === message.author.id) {
            return message.reply('❌ You cannot send coins to yourself!');
        }
        if (targetUser.bot) {
            return message.reply('❌ You cannot send coins to a bot!');
        }
        if (isNaN(amount) || amount <= 0) {
            return message.reply('Please specify a valid amount of coins to send!');
        }
        if (amount > userEco.balance) {
            return message.reply(`❌ You do not have enough coins! Your balance is **${userEco.balance} coins**.`);
        }

        const targetEco = getUserData(targetUser.id);
        userEco.balance -= amount;
        targetEco.balance += amount;
        saveData();

        return message.reply(`💸 Successfully transferred **${amount} coins** to ${targetUser}!`);
    }

    // ==========================================
    // 🛡️ CLAN SYSTEM & BANK
    // ==========================================
    if (command === 'createclan') {
        const clanName = args.join(' ');
        if (!clanName) return message.reply('Please provide a clan name!');
        if (clans[clanName]) return message.reply('A clan with that name already exists!');

        clans[clanName] = { owner: message.author.id, members: [message.author.id], bank: 0 };
        saveData();
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
        saveData();
        return message.reply(`🎉 You joined **${match}**!`);
    }

    if (command === 'leaveclan') {
        let leftClan = null;
        for (const [name, data] of Object.entries(clans)) {
            if (data.members.includes(message.author.id)) {
                if (data.owner === message.author.id) {
                    return message.reply('❌ You are the owner of this clan! Use `!deleteclan` to delete the clan instead of leaving.');
                }
                data.members = data.members.filter(id => id !== message.author.id);
                leftClan = name;
                break;
            }
        }
        if (!leftClan) return message.reply('You are not in any clan!');
        saveData();
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
                { name: '🏦 Clan Bank', value: `${data.bank || 0} coins`, inline: true },
                { name: 'Members', value: data.members.map(id => `<@${id}>`).join(', ') }
            );

        return message.channel.send({ embeds: [embed] });
    }

    if (command === 'deposit' || command === 'clanbank') {
        let userClan = null;
        for (const [name, data] of Object.entries(clans)) {
            if (data.members.includes(message.author.id)) {
                userClan = name;
                break;
            }
        }

        if (!userClan) return message.reply('You must be in a clan to use the clan bank!');

        if (command === 'clanbank') {
            return message.reply(`🏦 Clan **${userClan}** Bank Balance: **${clans[userClan].bank || 0} coins**.`);
        }

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return message.reply('Specify a valid amount to deposit!');
        if (amount > userEco.balance) return message.reply('You do not have enough coins in your wallet!');

        userEco.balance -= amount;
        clans[userClan].bank = (clans[userClan].bank || 0) + amount;
        saveData();

        return message.reply(`🏦 Deposited **${amount} coins** into **${userClan}**'s bank!`);
    }

    if (command === 'deleteclan') {
        let ownedClan = null;
        for (const [name, data] of Object.entries(clans)) {
            if (data.owner === message.author.id) {
                ownedClan = name;
                break;
            }
        }

        if (!ownedClan) {
            return message.reply('❌ You are not the owner of any clan!');
        }

        delete clans[ownedClan];
        saveData();
        return message.reply(`🗑️ Your clan **${ownedClan}** has been permanently deleted.`);
    }

    if (command === 'clandelete') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Only server administrators can use `!clandelete`!');
        }
        const clanName = args.join(' ');
        if (!clans[clanName]) return message.reply('Clan does not exist!');

        delete clans[clanName];
        saveData();
        return message.reply(`🗑️ Clan **${clanName}** has been deleted by Administrator.`);
    }

    // ==========================================
    // ⚙️ SERVER UTILITIES
    // ==========================================
    if (command === 'serverinfo') {
        const guild = message.guild;
        const serverEmbed = new EmbedBuilder()
            .setTitle(`📊 Server Info: ${guild.name}`)
            .setThumbnail(guild.iconURL())
            .setColor('#9B59B6')
            .addFields(
                { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: '👥 Total Members', value: `${guild.memberCount}`, inline: true },
                { name: '📅 Created On', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true }
            );

        return message.channel.send({ embeds: [serverEmbed] });
    }

    // ==========================================
    // 📜 COMPLETE MASTER HELP MENU
    // ==========================================
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('📜 Sxunya Core Complete Command List')
            .setColor('#5865F2')
            .addFields(
                { 
                    name: '🎮 General & Fun', 
                    value: '`!ping` - Latency check\n`!hug <@user>` - Hug someone\n`!slap <@user>` - Slap someone\n`!pat <@user>` - Pat someone\n`!kiss <@user>` - Kiss someone\n`!poke <@user>` - Poke someone\n`!cuddle <@user>` - Cuddle someone' 
                },
                { 
                    name: '💰 Economy & Games', 
                    value: '`!daily` - Claim 250 daily coins\n`!balance` or `!bal` - Check coin wallet\n`!givemoney <@user> <amount>` - Transfer coins to a user\n`!coinflip <heads/tails> <amount>` - Gamble coins\n`!profile [@user]` - View complete user profile' 
                },
                { 
                    name: '🛡️ Clan System', 
                    value: '`!createclan <name>` - Create a clan\n`!joinclan <name>` - Join a clan\n`!leaveclan` - Leave current clan\n`!deleteclan` - Delete your clan (Clan Owner Only)\n`!claninfo [name]` - View clan details\n`!clanbank` - View clan bank\n`!deposit <amount>` - Deposit coins into clan bank' 
                },
                { 
                    name: '⚙️ Utilities & Admin Commands', 
                    value: '`!serverinfo` - Display server information\n`!setup-ticket` - Create a ticket panel (Admin)\n`!poll <question>` - Create a poll (Admin)\n`!enableautoroles` - Enable member auto-role (Admin)\n`!disableautoroles` - Disable member auto-role (Admin)\n`!clandelete <name>` - Delete any clan (Admin Override)' 
                }
            )
            .setFooter({ text: 'Use ! prefix before every command.' });

        return message.channel.send({ embeds: [helpEmbed] });
    }
});

client.login(process.env.DISCORD_TOKEN);
