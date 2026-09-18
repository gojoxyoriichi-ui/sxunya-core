const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    PermissionsBitField, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits,
    AttachmentBuilder
} = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Express Server for 24/7 Uptime (Render Keep-Alive)
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Sxunya Core Bot is online and operational!'));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

// ==========================================
// 🍃 MONGODB ATLAS DATABASE SETUP
// ==========================================
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Successfully connected to MongoDB Atlas!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- Schemas ---
const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 100 },
    bankBalance: { type: Number, default: 0 },
    lastDaily: { type: Number, default: 0 },
    lastWork: { type: Number, default: 0 },
    lastCrime: { type: Number, default: 0 },
    lastRob: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    inventory: { type: Array, default: [] },
    warnings: { type: Array, default: [] }
});

const ClanSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    owner: { type: String, required: true },
    admins: { type: Array, default: [] },
    members: { type: Array, default: [] },
    bank: { type: Number, default: 0 },
    description: { type: String, default: 'No description set.' },
    trophies: { type: Number, default: 0 }
});

const SettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    autoRoleEnabled: { type: Boolean, default: false },
    autoRoleName: { type: String, default: 'Member' },
    modLogChannelId: { type: String, default: '' },
    ticketLogChannelId: { type: String, default: '1502598979987308705' },
    levelingEnabled: { type: Boolean, default: true }
});

const User = mongoose.model('User', UserSchema);
const Clan = mongoose.model('Clan', ClanSchema);
const Settings = mongoose.model('Settings', SettingsSchema);

// --- Helper Functions ---
async function getUserData(userId) {
    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });
    return user;
}

async function getGuildSettings(guildId) {
    let setting = await Settings.findOne({ guildId });
    if (!setting) setting = await Settings.create({ guildId });
    return setting;
}

const PREFIX = '!';

// IDs Configuration
const TICKET_LOG_CHANNEL_ID = '1502598979987308705';
const MODERATOR_ROLE_ID = '1483100413552230450';
const HEAD_MODERATOR_ROLE_ID = '1502659939498332160';
const TICKET_MANAGER_ROLE_ID = '1549768702642356264';
const ASSISTANT_MANAGER_ROLE_ID = '1542062882286739567';

const STAFF_ROLES = [
    MODERATOR_ROLE_ID,
    HEAD_MODERATOR_ROLE_ID,
    ASSISTANT_MANAGER_ROLE_ID,
    TICKET_MANAGER_ROLE_ID
];

const SHOP_ITEMS = [
    { id: 'vip', name: '👑 VIP Role', price: 1500, description: 'Unlocks the VIP role in the server.', type: 'role', roleName: 'VIP' },
    { id: 'title_legend', name: '🔥 "Legend" Title', price: 500, description: 'A custom badge tag added to your profile inventory.', type: 'badge' },
    { id: 'mysterybox', name: '🎁 Mystery Lootbox', price: 300, description: 'A surprise item or coin reward!', type: 'consumable' },
    { id: 'shield', name: '🛡️ Rob Shield', price: 1000, description: 'Protects your wallet from getting robbed for 1 attempt.', type: 'consumable' }
];

function hasModPermission(member, permissionFlag) {
    if (!member) return false;
    const hasRole = member.roles.cache.some(role => STAFF_ROLES.includes(role.id));
    const hasPerm = member.permissions.has(permissionFlag);
    return hasRole || hasPerm;
}

const ticketCreators = new Map();

// ==========================================
// 🤖 CLIENT READY EVENT
// ==========================================
client.once('ready', () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
    client.user.setActivity('over the server | !help', { type: 3 });
});

// ==========================================
// 🎟️ TICKET INTERACTION HANDLER
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

// ==========================================
// 🙋 WELCOME & AUTO-ROLE EVENT
// ==========================================
client.on('guildMemberAdd', async (member) => {
    try {
        const guildSettings = await getGuildSettings(member.guild.id);

        if (guildSettings.autoRoleEnabled) {
            const role = member.guild.roles.cache.find(r => r.name === guildSettings.autoRoleName);
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
            
            channel.send({ embeds: [welcomeEmbed] }).catch(() => {});
        }
    } catch (e) {
        console.error('Welcome Error:', e);
    }
});

// ==========================================
// 📝 AUDIT LOG EVENTS (DELETE & EDIT)
// ==========================================
client.on('messageDelete', async (message) => {
    if (!message.guild || message.author?.bot) return;
    try {
        const settings = await getGuildSettings(message.guild.id);
        if (!settings.modLogChannelId) return;

        const logChannel = message.guild.channels.cache.get(settings.modLogChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Deleted')
            .setColor('#E74C3C')
            .addFields(
                { name: 'Author', value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
                { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                { name: 'Content', value: message.content || '*No text content*' }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
    } catch (e) {
        console.error(e);
    }
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
    try {
        const settings = await getGuildSettings(oldMessage.guild.id);
        if (!settings.modLogChannelId) return;

        const logChannel = oldMessage.guild.channels.cache.get(settings.modLogChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('✏️ Message Edited')
            .setColor('#F1C40F')
            .addFields(
                { name: 'Author', value: `${oldMessage.author.tag} (<@${oldMessage.author.id}>)`, inline: true },
                { name: 'Channel', value: `<#${oldMessage.channel.id}>`, inline: true },
                { name: 'Before', value: oldMessage.content || '*Empty*' },
                { name: 'After', value: newMessage.content || '*Empty*' }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
    } catch (e) {
        console.error(e);
    }
});

// ==========================================
// 💬 MAIN MESSAGE COMMANDS HANDLER
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    try {
        // --- AUTOMOD LINK CHECKER ---
        if (!hasModPermission(message.member, PermissionsBitField.Flags.ManageMessages)) {
            const linkRegex = /(https?:\/\/[^\s]+)/g;
            if (linkRegex.test(message.content)) {
                await message.delete().catch(() => {});
                return message.channel.send(`⚠️ <@${message.author.id}>, posting links is prohibited here!`)
                    .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
            }
        }

        // --- LEVELING / XP SYSTEM ---
        const userEco = await getUserData(message.author.id);
        const xpGained = Math.floor(Math.random() * 10) + 15;
        userEco.xp += xpGained;

        const xpNeeded = userEco.level * 100;
        if (userEco.xp >= xpNeeded) {
            userEco.level += 1;
            userEco.xp -= xpNeeded;
            message.channel.send(`🎉 Congratulations <@${message.author.id}>, you leveled up to **Level ${userEco.level}**!`).catch(() => {});
        }
        await userEco.save();

        if (!message.content.startsWith(PREFIX)) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // ==========================================
        // 🛡️ MODERATION COMMANDS
        // ==========================================
        if (command === 'kick') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.KickMembers)) return message.reply('❌ You lack permission to kick members.');
            const target = message.mentions.members.first();
            if (!target) return message.reply('Usage: `!kick @user [reason]`');
            if (!target.kickable) return message.reply('❌ Cannot kick this user.');

            const reason = args.slice(1).join(' ') || 'No reason provided';
            await target.kick(reason);
            return message.reply(`✅ **${target.user.tag}** was kicked. Reason: *${reason}*`);
        }

        if (command === 'ban') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.BanMembers)) return message.reply('❌ You lack permission to ban members.');
            const target = message.mentions.members.first();
            if (!target) return message.reply('Usage: `!ban @user [reason]`');
            if (!target.bannable) return message.reply('❌ Cannot ban this user.');

            const reason = args.slice(1).join(' ') || 'No reason provided';
            await target.ban({ reason });
            return message.reply(`🔨 **${target.user.tag}** was banned. Reason: *${reason}*`);
        }

        if (command === 'softban') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.BanMembers)) return message.reply('❌ You lack permission.');
            const target = message.mentions.members.first();
            if (!target) return message.reply('Usage: `!softban @user [reason]`');

            const reason = args.slice(1).join(' ') || 'Softban';
            await target.ban({ deleteMessageDays: 7, reason });
            await message.guild.members.unban(target.id);
            return message.reply(`🧹 **${target.user.tag}** softbanned (kicked and 7 days of messages cleared).`);
        }

        if (command === 'unban') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.BanMembers)) return message.reply('❌ You lack permission.');
            const userId = args[0];
            if (!userId) return message.reply('Usage: `!unban <user_id>`');

            try {
                await message.guild.members.unban(userId);
                return message.reply(`✅ Successfully unbanned ID: \`${userId}\``);
            } catch {
                return message.reply('❌ User not found or not banned.');
            }
        }

        if (command === 'mute' || command === 'timeout') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ You lack permission.');
            const target = message.mentions.members.first();
            const minutes = parseInt(args[1]);
            if (!target || isNaN(minutes)) return message.reply('Usage: `!mute @user <minutes> [reason]`');

            const reason = args.slice(2).join(' ') || 'No reason provided';
            await target.timeout(minutes * 60 * 1000, reason);
            return message.reply(`🔇 **${target.user.tag}** timed out for **${minutes}m**. Reason: *${reason}*`);
        }

        if (command === 'unmute') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ You lack permission.');
            const target = message.mentions.members.first();
            if (!target) return message.reply('Usage: `!unmute @user`');

            await target.timeout(null);
            return message.reply(`🔊 Mute removed for **${target.user.tag}**.`);
        }

        if (command === 'clear' || command === 'purge') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.ManageMessages)) return message.reply('❌ You lack permission.');
            const amount = parseInt(args[0]);
            if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('Specify a number between 1 and 100.');

            await message.channel.bulkDelete(amount + 1, true);
            return message.channel.send(`🧹 Deleted **${amount}** messages.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
        }

        if (command === 'warn') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.ManageMessages)) return message.reply('❌ You lack permission.');
            const targetUser = message.mentions.users.first();
            if (!targetUser) return message.reply('Usage: `!warn @user <reason>`');

            const reason = args.slice(1).join(' ');
            if (!reason) return message.reply('Please provide a reason.');

            const targetEco = await getUserData(targetUser.id);
            targetEco.warnings.push({ reason, moderator: message.author.id, date: new Date() });
            await targetEco.save();

            return message.reply(`⚠️ Warned **${targetUser.tag}**. Reason: *${reason}* (Total warnings:${targetEco.warnings.length})`);
        }

        if (command === 'warnings') {
            const targetUser = message.mentions.users.first() || message.author;
            const targetEco = await getUserData(targetUser.id);

            if (targetEco.warnings.length === 0) return message.reply(`✅ **${targetUser.username}** has no warnings.`);

            const warnEmbed = new EmbedBuilder()
                .setTitle(`⚠️ Warnings for ${targetUser.username}`)
                .setColor('#E74C3C')
                .setDescription(targetEco.warnings.map((w, index) => `**#${index + 1}** — ${w.reason} (By: <@${w.moderator}>)`).join('\n'));

            return message.channel.send({ embeds: [warnEmbed] });
        }

        if (command === 'lock') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ You lack permission.');
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            return message.reply('🔒 Channel locked down.');
        }

        if (command === 'unlock') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ You lack permission.');
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
            return message.reply('🔓 Channel unlocked.');
        }

        if (command === 'slowmode') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ You lack permission.');
            const seconds = parseInt(args[0]);
            if (isNaN(seconds)) return message.reply('Usage: `!slowmode <seconds>`');

            await message.channel.setRateLimitPerUser(seconds);
            return message.reply(`⏱️ Slowmode set to **${seconds}s**.`);
        }

        if (command === 'nick' || command === 'nickname') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.ManageNicknames)) return message.reply('❌ You lack permission.');
            const target = message.mentions.members.first();
            if (!target) return message.reply('Usage: `!nick @user <new_nickname>`');

            const newNick = args.slice(1).join(' ');
            await target.setNickname(newNick);
            return message.reply(`✅ Nickname updated for **${target.user.username}**.`);
        }

        // ==========================================
        // 🪙 ECONOMY & MINI-GAMES COMMANDS
        // ==========================================
        if (command === 'daily') {
            const cooldown = 24 * 60 * 60 * 1000;
            const now = Date.now();

            if (now - userEco.lastDaily < cooldown) {
                const timeLeft = cooldown - (now - userEco.lastDaily);
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                return message.reply(`⌛ Daily collected! Return in **${hoursLeft}h${minutesLeft}m**.`);
            }

            const reward = 250;
            userEco.balance += reward;
            userEco.lastDaily = now;
            await userEco.save();

            return message.reply(`🪙 You received **${reward} coins**! Current Balance: **${userEco.balance}**.`);
        }

        if (command === 'work') {
            const cooldown = 60 * 60 * 1000;
            const now = Date.now();

            if (now - userEco.lastWork < cooldown) {
                const minutesLeft = Math.floor((cooldown - (now - userEco.lastWork)) / (1000 * 60));
                return message.reply(`💼 You are tired! Rest for **${minutesLeft}m** before working again.`);
            }

            const jobs = ['Programmer', 'Discord Mod', 'Barista', 'Gamer', 'Graphic Designer'];
            const job = jobs[Math.floor(Math.random() * jobs.length)];
            const earned = Math.floor(Math.random() * 150) + 50;

            userEco.balance += earned;
            userEco.lastWork = now;
            await userEco.save();

            return message.reply(`💼 Worked as a **${job}** and earned **${earned} coins**!`);
        }

        if (command === 'crime') {
            const cooldown = 2 * 60 * 60 * 1000;
            const now = Date.now();

            if (now - userEco.lastCrime < cooldown) {
                const minutesLeft = Math.floor((cooldown - (now - userEco.lastCrime)) / (1000 * 60));
                return message.reply(`🚓 Lay low! You can attempt a crime in **${minutesLeft}m**.`);
            }

            userEco.lastCrime = now;
            const success = Math.random() > 0.45;

            if (success) {
                const reward = Math.floor(Math.random() * 300) + 150;
                userEco.balance += reward;
                await userEco.save();
                return message.reply(`🥷 Successful heist! You looted **${reward} coins**!`);
            } else {
                const penalty = Math.floor(Math.random() * 100) + 50;
                userEco.balance = Math.max(0, userEco.balance - penalty);
                await userEco.save();
                return message.reply(`🚔 You got caught by the cops and fined **${penalty} coins**!`);
            }
        }

        if (command === 'rob') {
            const target = message.mentions.users.first();
            if (!target) return message.reply('Usage: `!rob @user`');
            if (target.id === message.author.id) return message.reply('❌ You cannot rob yourself.');

            const targetEco = await getUserData(target.id);
            if (targetEco.balance < 50) return message.reply('❌ Target is too poor to rob!');

            const success = Math.random() > 0.5;
            if (success) {
                const stolen = Math.floor(targetEco.balance * (Math.random() * 0.4 + 0.1));
                targetEco.balance -= stolen;
                userEco.balance += stolen;
                await targetEco.save();
                await userEco.save();
                return message.reply(`🥷 You robbed **${stolen} coins** from ${target}!`);
            } else {
                const fine = 100;
                userEco.balance = Math.max(0, userEco.balance - fine);
                await userEco.save();
                return message.reply(`🚨 You failed the robbery and paid a **${fine} coin** fine!`);
            }
        }

        if (command === 'balance' || command === 'bal') {
            const targetUser = message.mentions.users.first() || message.author;
            const targetEco = await getUserData(targetUser.id);
            return message.reply(`💰 **${targetUser.username}**'s Wallet: **${targetEco.balance} coins** \vert{} Bank: **${targetEco.bankBalance} coins**.`);
        }

        if (command === 'deposit' || command === 'dep') {
            const amount = args[0] === 'all' ? userEco.balance : parseInt(args[0]);
            if (isNaN(amount) || amount <= 0) return message.reply('Specify a valid amount.');
            if (amount > userEco.balance) return message.reply('❌ Insufficient balance.');

            userEco.balance -= amount;
            userEco.bankBalance += amount;
            await userEco.save();

            return message.reply(`🏦 Deposited **${amount} coins** into your personal bank account!`);
        }

        if (command === 'withdraw' || command === 'with') {
            const amount = args[0] === 'all' ? userEco.bankBalance : parseInt(args[0]);
            if (isNaN(amount) || amount <= 0) return message.reply('Specify a valid amount.');
            if (amount > userEco.bankBalance) return message.reply('❌ Insufficient bank funds.');

            userEco.bankBalance -= amount;
            userEco.balance += amount;
            await userEco.save();

            return message.reply(`💵 Withdrew **${amount} coins** from your bank account!`);
        }

        if (command === 'slots') {
            const bet = parseInt(args[0]);
            if (isNaN(bet) || bet <= 0) return message.reply('Usage: `!slots <bet_amount>`');
            if (bet > userEco.balance) return message.reply('❌ Insufficient balance!');

            const items = ['🎰', '🍒', '🍋', '🔔', '💎'];
            const r1 = items[Math.floor(Math.random() * items.length)];
            const r2 = items[Math.floor(Math.random() * items.length)];
            const r3 = items[Math.floor(Math.random() * items.length)];

            let winnings = 0;
            if (r1 === r2 && r2 === r3) {
                winnings = bet * 5;
            } else if (r1 === r2 || r2 === r3 || r1 === r3) {
                winnings = bet * 2;
            }

            if (winnings > 0) {
                userEco.balance += winnings;
                await userEco.save();
                return message.reply(`[ ${r1} | ${r2} \vert{}${r3} ]\n🎉 YOU WON **${winnings} coins**!`);
            } else {
                userEco.balance -= bet;
                await userEco.save();
                return message.reply(`[ ${r1} | ${r2} \vert{}${r3} ]\n❌ You lost **${bet} coins**.`);
            }
        }

        if (command === 'coinflip' || command === 'cf') {
            const choice = args[0]?.toLowerCase();
            const bet = parseInt(args[1]);

            if (!['heads', 'tails'].includes(choice) || isNaN(bet) || bet <= 0) {
                return message.reply('Usage: `!coinflip <heads/tails> <bet_amount>`');
            }
            if (bet > userEco.balance) return message.reply('❌ Insufficient coins.');

            const result = Math.random() > 0.5 ? 'heads' : 'tails';
            if (choice === result) {
                userEco.balance += bet;
                await userEco.save();
                return message.reply(`🪙 Flipped **${result}**! You won **${bet} coins**!`);
            } else {
                userEco.balance -= bet;
                await userEco.save();
                return message.reply(`🪙 Flipped **${result}**! You lost **${bet} coins**.`);
            }
        }

        if (command === 'shop') {
            const shopEmbed = new EmbedBuilder()
                .setTitle('🛒 Server Economy Shop')
                .setColor('#F1C40F')
                .setDescription('Use `!buy <item_id>` to buy items!')
                .setFooter({ text: `Balance: ${userEco.balance} coins` });

            SHOP_ITEMS.forEach(i => {
                shopEmbed.addFields({ name: `${i.name} —${i.price} coins`, value: `**ID:** \`${i.id}\`\n${i.description}` });
            });

            return message.channel.send({ embeds: [shopEmbed] });
        }

        if (command === 'buy') {
            const itemId = args[0]?.toLowerCase();
            const item = SHOP_ITEMS.find(i => i.id === itemId);
            if (!item) return message.reply('❌ Invalid Item ID.');

            if (userEco.balance < item.price) return message.reply('❌ Insufficient balance!');

            userEco.balance -= item.price;
            userEco.inventory.push(item.name);
            await userEco.save();

            return message.reply(`🎉 Purchased **${item.name}**!`);
        }

        if (command === 'inventory' || command === 'inv') {
            const targetUser = message.mentions.users.first() || message.author;
            const targetEco = await getUserData(targetUser.id);

            const itemsList = targetEco.inventory.length > 0 ? targetEco.inventory.map(i => `• ${i}`).join('\n') : 'Empty Inventory.';
            const embed = new EmbedBuilder()
                .setTitle(`🎒 Inventory: ${targetUser.username}`)
                .setColor('#2ECC71')
                .setDescription(itemsList);

            return message.channel.send({ embeds: [embed] });
        }

        // ==========================================
        // ⚔️ CLAN SYSTEM
        // ==========================================
        if (command === 'createclan') {
            const clanName = args.join(' ');
            if (!clanName) return message.reply('Provide a clan name.');

            const existing = await Clan.findOne({ name: clanName });
            if (existing) return message.reply('Clan name already taken.');

            await Clan.create({
                name: clanName,
                owner: message.author.id,
                members: [message.author.id]
            });

            return message.reply(`⚔️ Clan **${clanName}** successfully established!`);
        }

        if (command === 'joinclan') {
            const searchName = args.join(' ');
            const clan = await Clan.findOne({ name: new RegExp(`^${searchName}$`, 'i') });
            if (!clan) return message.reply('Clan not found.');

            if (clan.members.includes(message.author.id)) return message.reply('You are already in this clan.');

            clan.members.push(message.author.id);
            await clan.save();
            return message.reply(`🎉 Joined **${clan.name}**!`);
        }

        if (command === 'leaveclan') {
            const clan = await Clan.findOne({ members: message.author.id });
            if (!clan) return message.reply('You are not in a clan.');
            if (clan.owner === message.author.id) return message.reply('Owners must delete the clan using `!deleteclan`.');

            clan.members = clan.members.filter(id => id !== message.author.id);
            await clan.save();
            return message.reply(`🚪 Left **${clan.name}**.`);
        }

        if (command === 'claninfo') {
            const searchName = args.join(' ');
            let clan = searchName ? await Clan.findOne({ name: new RegExp(`^${searchName}$`, 'i') }) : await Clan.findOne({ members: message.author.id });

            if (!clan) return message.reply('Clan not found.');

            const embed = new EmbedBuilder()
                .setTitle(`🛡️ Clan: ${clan.name}`)
                .setColor('#FFD700')
                .addFields(
                    { name: 'Owner', value: `<@${clan.owner}>`, inline: true },
                    { name: 'Members', value: `${clan.members.length}`, inline: true },
                    { name: 'Bank', value: `${clan.bank} coins`, inline: true },
                    { name: 'Description', value: clan.description }
                );

            return message.channel.send({ embeds: [embed] });
        }

        if (command === 'deleteclan') {
            const clan = await Clan.findOne({ owner: message.author.id });
            if (!clan) return message.reply('You do not own a clan.');

            await Clan.deleteOne({ name: clan.name });
            return message.reply(`🗑️ Clan **${clan.name}** deleted.`);
        }

        // ==========================================
        // 📊 LEVEL & LEADERBOARD SYSTEM
        // ==========================================
        if (command === 'rank' || command === 'level') {
            const targetUser = message.mentions.users.first() || message.author;
            const targetEco = await getUserData(targetUser.id);

            const embed = new EmbedBuilder()
                .setTitle(`⭐ Level Status: ${targetUser.username}`)
                .setColor('#9B59B6')
                .addFields(
                    { name: 'Level', value: `\`${targetEco.level}\``, inline: true },
                    { name: 'Current XP', value: `\`${targetEco.xp} / ${targetEco.level * 100}\``, inline: true }
                );

            return message.channel.send({ embeds: [embed] });
        }

        if (command === 'leaderboard' || command === 'lb') {
            const topUsers = await User.find({}).sort({ balance: -1 }).limit(10);
            
            let desc = '';
            topUsers.forEach((u, i) => {
                desc += `**#${i + 1}** <@${u.userId}> — **${u.balance} coins**\n`;
            });

            const lbEmbed = new EmbedBuilder()
                .setTitle('🏆 Economy Leaderboard')
                .setColor('#F1C40F')
                .setDescription(desc || 'No rankings recorded yet.');

            return message.channel.send({ embeds: [lbEmbed] });
        }

        // ==========================================
        // ⚙️ UTILITY & CONFIGURATION COMMANDS
        // ==========================================
        if (command === 'setlogchannel') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.Administrator)) return message.reply('❌ Admin required.');
            const settings = await getGuildSettings(message.guild.id);
            settings.modLogChannelId = message.channel.id;
            await settings.save();
            return message.reply(`✅ Set <#${message.channel.id}> as the audit log channel.`);
        }

        if (command === 'setup-ticket') {
            if (!hasModPermission(message.member, PermissionsBitField.Flags.Administrator)) return message.reply('❌ Admin required.');

            const ticketPanelEmbed = new EmbedBuilder()
                .setTitle('🎟️ Support Tickets')
                .setDescription('Click below to open a private support ticket with staff!')
                .setColor('#5865F2');

            const ticketButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('📩 Open Ticket')
                    .setStyle(ButtonStyle.Primary)
            );

            await message.channel.send({ embeds: [ticketPanelEmbed], components: [ticketButton] });
            return message.delete().catch(() => {});
        }

        if (command === 'avatar') {
            const target = message.mentions.users.first() || message.author;
            const embed = new EmbedBuilder()
                .setTitle(`${target.username}'s Avatar`)
                .setImage(target.displayAvatarURL({ dynamic: true, size: 512 }))
                .setColor('#5865F2');

            return message.channel.send({ embeds: [embed] });
        }

        if (command === 'serverinfo') {
            const embed = new EmbedBuilder()
                .setTitle(`📊 ${message.guild.name} Info`)
                .setColor('#5865F2')
                .setThumbnail(message.guild.iconURL())
                .addFields(
                    { name: 'Total Members', value: `${message.guild.memberCount}`, inline: true },
                    { name: 'Created On', value: `<t:${Math.floor(message.guild.createdTimestamp / 1000)}:D>`, inline: true },
                    { name: 'Server Owner', value: `<@${message.guild.ownerId}>`, inline: true }
                );

            return message.channel.send({ embeds: [embed] });
        }

        if (command === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setTitle('📜 Sxunya Core Full Command Matrix')
                .setColor('#5865F2')
                .addFields(
                    { name: '🛡️ Moderation', value: '`!kick`, `!ban`, `!softban`, `!unban`, `!mute`, `!unmute`, `!warn`, `!warnings`, `!lock`, `!unlock`, `!slowmode`, `!clear`, `!nick`' },
                    { name: '🪙 Economy & Games', value: '`!daily`, `!work`, `!crime`, `!rob`, `!balance`, `!deposit`, `!withdraw`, `!slots`, `!coinflip`, `!shop`, `!buy`, `!inventory`, `!leaderboard`' },
                    { name: '⚔️ Clans', value: '`!createclan`, `!joinclan`, `!leaveclan`, `!claninfo`, `!deleteclan`' },
                    { name: '📊 XP & Utility', value: '`!rank`, `!setup-ticket`, `!setlogchannel`, `!avatar`, `!serverinfo`' }
                );

            return message.channel.send({ embeds: [helpEmbed] });
        }
    } catch (err) {
        console.error('Error handling command:', err);
    }
});

client.login(process.env.DISCORD_TOKEN);
