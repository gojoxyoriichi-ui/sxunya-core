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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans
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

// IDs Configuration
const TICKET_LOG_CHANNEL_ID = '1502598979987308705';
const MODERATOR_ROLE_ID = '1483100413552230450';
const HEAD_MODERATOR_ROLE_ID = '1502659939498332160';
const TICKET_MANAGER_ROLE_ID = '1549768702642356264';
const ASSISTANT_MANAGER_ROLE_ID = '1542062882286739567';

// Allowed Staff Roles for Moderation Commands
const STAFF_ROLES = [
    MODERATOR_ROLE_ID,
    HEAD_MODERATOR_ROLE_ID,
    ASSISTANT_MANAGER_ROLE_ID,
    TICKET_MANAGER_ROLE_ID
];

// Permission Helper
function hasModPermission(member, permissionFlag) {
    const hasRole = member.roles.cache.some(role => STAFF_ROLES.includes(role.id));
    const hasPerm = member.permissions.has(permissionFlag);
    return hasRole || hasPerm;
}

// Store ticket creators in memory for log tracking
const ticketCreators = new Map();

// ==========================================
// 🎟️ TICKET BUTTON INTERACTION HANDLER
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'create_ticket') {
        const ticketChannelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        
        const existingChannel = interaction.guild.channels.cache.find(c => c.name === ticketChannelName);
        if (existingChannel) {
            return interaction.reply({ content: `❌ You already have an open ticket: ${existingChannel}`, ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const ticketChannel = await interaction.guild.channels.create({
                name: ticketChannelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    { id: MODERATOR_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    { id: HEAD_MODERATOR_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    { id: TICKET_MANAGER_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                ],
            });

            ticketCreators.set(ticketChannel.id, interaction.user.id);

            // Instant Ticket Creation Log
            const logChannel = interaction.guild.channels.cache.get(TICKET_LOG_CHANNEL_ID);
            if (logChannel) {
                const createLogEmbed = new EmbedBuilder()
                    .setTitle('🎟️ Ticket Created')
                    .setColor('#2ECC71')
                    .addFields(
                        { name: '📁 Ticket Channel', value: `${ticketChannel}`, inline: true },
                        { name: '👤 Opened By', value: `<@${interaction.user.id}>`, inline: true },
                        { name: '⏰ Created At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [createLogEmbed] }).catch(err => console.log('Could not send creation log:', err));
            }

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

            // Tag Moderator, Head Moderator, and Ticket Manager inside ticket
            const pingMessage = `<@${interaction.user.id}> <@&${MODERATOR_ROLE_ID}> <@&${HEAD_MODERATOR_ROLE_ID}> <@&${TICKET_MANAGER_ROLE_ID}>`;

            await ticketChannel.send({ content: pingMessage, embeds: [welcomeTicketEmbed], components: [closeButton] });
            return interaction.editReply({ content: `✅ Ticket created! Check out your channel: ${ticketChannel}` });

        } catch (error) {
            console.error('Error creating ticket channel:', error);
            return interaction.editReply({ content: '❌ Failed to create ticket channel. Make sure the bot has **Manage Channels** permissions!' });
        }
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 Closing and deleting this ticket in 5 seconds...');

        const channel = interaction.channel;
        const creatorId = ticketCreators.get(channel.id) || 'Unknown User';

        // Instant Ticket Deletion Log
        const logChannel = interaction.guild.channels.cache.get(TICKET_LOG_CHANNEL_ID);
        if (logChannel) {
            const deleteLogEmbed = new EmbedBuilder()
                .setTitle('🗑️ Ticket Closed & Deleted')
                .setColor('#E74C3C')
                .addFields(
                    { name: '📁 Ticket Name', value: `${channel.name}`, inline: true },
                    { name: '👤 Opened By', value: creatorId !== 'Unknown User' ? `<@${creatorId}>` : 'Unknown', inline: true },
                    { name: '🔒 Closed By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '⏰ Deleted At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [deleteLogEmbed] }).catch(err => console.log('Could not send deletion log:', err));
        }

        ticketCreators.delete(channel.id);

        setTimeout(() => {
            channel.delete().catch(err => console.log('Could not delete ticket channel:', err));
        }, 5000);
    }
});

// Auto-Welcome System
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
    // 🛡️ MODERATION COMMANDS
    // ==========================================

    // !kick @user [reason]
    if (command === 'kick') {
        if (!hasModPermission(message.member, PermissionsBitField.Flags.KickMembers)) {
            return message.reply('❌ You lack the required Staff Role or permissions to kick members.');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('Usage: `!kick @user [reason]`');
        if (!target.kickable) return message.reply('❌ I cannot kick this user due to role hierarchy.');

        const reason = args.slice(1).join(' ') || 'No reason provided';
        await target.kick(reason);

        const kickEmbed = new EmbedBuilder()
            .setTitle('`👢` Member Kicked')
            .setColor('#E67E22')
            .addFields(
                { name: 'User', value: `${target.user.tag}`, inline: true },
                { name: 'Moderator', value: `${message.author.tag}`, inline: true },
                { name: 'Reason', value: reason }
            );

        return message.channel.send({ embeds: [kickEmbed] });
    }

    // !ban @user [reason]
    if (command === 'ban') {
        if (!hasModPermission(message.member, PermissionsBitField.Flags.BanMembers)) {
            return message.reply('❌ You lack the required Staff Role or permissions to ban members.');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('Usage: `!ban @user [reason]`');
        if (!target.bannable) return message.reply('❌ I cannot ban this user due to role hierarchy.');

        const reason = args.slice(1).join(' ') || 'No reason provided';
        await target.ban({ reason });

        const banEmbed = new EmbedBuilder()
            .setTitle('🔨 Member Banned')
            .setColor('#C0392B')
            .addFields(
                { name: 'User', value: `${target.user.tag}`, inline: true },
                { name: 'Moderator', value: `${message.author.tag}`, inline: true },
                { name: 'Reason', value: reason }
            );

        return message.channel.send({ embeds: [banEmbed] });
    }

    // !unban <userID>
    if (command === 'unban') {
        if (!hasModPermission(message.member, PermissionsBitField.Flags.BanMembers)) {
            return message.reply('❌ You lack the required Staff Role or permissions to unban members.');
        }

        const userId = args[0];
        if (!userId) return message.reply('Usage: `!unban <userID>`');

        try {
            await message.guild.members.unban(userId);
            return message.reply(`✅ Successfully unbanned user ID \`${userId}\`.`);
        } catch (error) {
            return message.reply('❌ Unable to unban user. Verify the User ID and ban status.');
        }
    }

    // !timeout @user <minutes> [reason]
    if (command === 'timeout') {
        if (!hasModPermission(message.member, PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ You lack the required Staff Role or permissions to timeout members.');
        }

        const target = message.mentions.members.first();
        const durationMinutes = parseInt(args[1]);

        if (!target || isNaN(durationMinutes) || durationMinutes <= 0) {
            return message.reply('Usage: `!timeout @user <duration_in_minutes> [reason]`');
        }

        if (!target.moderatable) return message.reply('❌ I cannot place this user in timeout due to role hierarchy.');

        const durationMs = durationMinutes * 60 * 1000;
        const reason = args.slice(2).join(' ') || 'No reason provided';

        await target.timeout(durationMs, reason);

        const timeoutEmbed = new EmbedBuilder()
            .setTitle('⏰ Member Timed Out')
            .setColor('#F1C40F')
            .addFields(
                { name: 'User', value: `${target.user.tag}`, inline: true },
                { name: 'Duration', value: `${durationMinutes} minutes`, inline: true },
                { name: 'Moderator', value: `${message.author.tag}`, inline: true },
                { name: 'Reason', value: reason }
            );

        return message.channel.send({ embeds: [timeoutEmbed] });
    }

    // !removetimeout @user
    if (command === 'removetimeout' || command === 'untimeout') {
        if (!hasModPermission(message.member, PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ You lack the required Staff Role or permissions to remove timeouts.');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('Usage: `!removetimeout @user`');

        if (!target.communicationDisabledUntilTimestamp) {
            return message.reply('❌ This user is not currently in timeout.');
        }

        await target.timeout(null, `Timeout removed by ${message.author.tag}`);
        return message.reply(`✅ Removed timeout for ${target}.`);
    }

    // ==========================================
    // 🎟️ TICKET SETUP COMMAND
    // ==========================================
    if (command === 'setup-ticket') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Only server administrators can use `!setup-ticket`!');
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
    // ⚙️ TOGGLABLE AUTO-ROLE COMMANDS
    // ==========================================
    if (command === 'enableautoroles') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Only server administrators can use this command!');
        }

        guildSettings.autoRoleEnabled = true;
        saveData();
        return message.reply('✅ Auto-roles have been **enabled**!');
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
    // 📊 COMMUNITY POLL COMMAND
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
        return message.reply(`🏓 Pong! Latency: ${Date.now() - message.createdTimestamp}ms. API Latency: ${Math.round(client.ws.ping)}ms.`);
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

        return message.reply(`🪙 You collected your daily reward of **${reward} coins**! Balance: **${userEco.balance} coins**.`);
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

        if (!targetUser) return message.reply('Usage: `!givemoney @user <amount>`');
        if (targetUser.id === message.author.id) return message.reply('❌ You cannot send coins to yourself!');
        if (targetUser.bot) return message.reply('❌ You cannot send coins to a bot!');
        if (isNaN(amount) || amount <= 0) return message.reply('Please specify a valid amount of coins!');
        if (amount > userEco.balance) return message.reply(`❌ You do not have enough coins! Balance: **${userEco.balance} coins**.`);

        const targetEco = getUserData(targetUser.id);
        userEco.balance -= amount;
        targetEco.balance += amount;
        saveData();

        return message.reply(`💸 Transferred **${amount} coins** to ${targetUser}!`);
    }

    // ==========================================
    // 🛡️ CLAN SYSTEM
    // ==========================================
    if (command === 'createclan') {
        const clanName = args.join(' ');
        if (!clanName) return message.reply('Please provide a clan name!');
        if (clans[clanName]) return message.reply('A clan with that name already exists!');

        clans[clanName] = { owner: message.author.id, members: [message.author.id], bank: 0 };
        saveData();
        return message.reply(`✅ Clan **${clanName}** created!`);
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
                    return message.reply('❌ You are the owner of this clan! Use `!deleteclan` to delete it instead.');
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
        if (amount > userEco.balance) return message.reply('You do not have enough coins!');

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

        if (!ownedClan) return message.reply('❌ You are not the owner of any clan!');

        delete clans[ownedClan];
        saveData();
        return message.reply(`🗑️ Your clan **${ownedClan}** has been deleted.`);
    }

    if (command === 'clandelete') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Only administrators can use `!clandelete`!');
        }
        const clanName = args.join(' ');
        if (!clans[clanName]) return message.reply('Clan does not exist!');

        delete clans[clanName];
        saveData();
        return message.reply(`🗑️ Clan **${clanName}** deleted by Administrator.`);
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
    // 📜 FULL HELP MENU
    // ==========================================
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('📜 Sxunya Core Master Help Menu')
            .setColor('#5865F2')
            .addFields(
                { 
                    name: '🛡️ Moderation Commands (Staff Allowed)', 
                    value: '`!kick <@user> [reason]` - Kick a member\n`!ban <@user> [reason]` - Ban a member\n`!unban <userID>` - Unban a member by User ID\n`!timeout <@user> <mins> [reason]` - Timeout a member\n`!removetimeout <@user>` - Remove a active timeout' 
                },
                { 
                    name: '🎮 General & Fun Actions', 
                    value: '`!ping` - Check latency\n`!hug <@user>` - Hug someone\n`!slap <@user>` - Slap someone\n`!pat <@user>` - Pat someone\n`!kiss <@user>` - Kiss someone\n`!poke <@user>` - Poke someone\n`!cuddle <@user>` - Cuddle someone' 
                },
                { 
                    name: '💰 Economy & Profile', 
                    value: '`!daily` - Claim 250 daily coins\n`!balance` or `!bal` - View wallet balance\n`!givemoney <@user> <amount>` - Send coins to a member\n`!coinflip <heads/tails> <amount>` - Gamble coins\n`!profile [@user]` - View complete user profile' 
                },
                { 
                    name: '🛡️ Clan System', 
                    value: '`!createclan <name>` - Create a new clan\n`!joinclan <name>` - Join an existing clan\n`!leaveclan` - Leave current clan\n`!deleteclan` - Delete owned clan\n`!claninfo [name]` - Check clan details\n`!clanbank` - View clan balance\n`!deposit <amount>` - Deposit coins into clan bank' 
                },
                { 
                    name: '⚙️ Utilities & Admin Commands', 
                    value: '`!serverinfo` - Display server information\n`!setup-ticket` - Create a ticket panel\n`!poll <question>` - Create a 👍/👎 poll\n`!enableautoroles` - Enable member auto-role\n`!disableautoroles` - Disable member auto-role\n`!clandelete <name>` - Admin clan deletion override' 
                }
            )
            .setFooter({ text: 'Use ! prefix before every command.' });

        return message.channel.send({ embeds: [helpEmbed] });
    }
});

client.login(process.env.DISCORD_TOKEN);
