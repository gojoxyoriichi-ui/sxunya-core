require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Collection, 
    EmbedBuilder, 
    PermissionsBitField 
} = require('discord.js');
const mongoose = require('mongoose');
const express = require('express');

// ==========================================
// 1. EXPRESS KEEP-ALIVE SERVER (FOR RENDER)
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Sxunya Core is online and active.');
});

app.listen(PORT, () => {
    console.log(`Keep-alive server listening on port ${PORT}`);
});

// ==========================================
// 2. DISCORD CLIENT INITIALIZATION
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

client.commands = new Collection();

// Leveling System State (Disabled by Default)
let levelingEnabled = false;

// ==========================================
// 3. MONGOOSE SCHEMAS & MODELS
// ==========================================

// Economy Schema
const economySchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
    lastDaily: { type: Date, default: null }
});
const Economy = mongoose.model('Economy', economySchema);

// User Leveling Schema
const levelSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
});
const Level = mongoose.model('Level', levelSchema);

// Ticket Schema
const ticketSchema = new mongoose.Schema({
    ticketId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    userId: { type: String, required: true },
    status: { type: String, default: 'OPEN' }
});
const Ticket = mongoose.model('Ticket', ticketSchema);

// Connect to MongoDB
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('Connected to MongoDB Atlas'))
        .catch((err) => console.error('MongoDB connection error:', err));
} else {
    console.warn('MONGODB_URI is not defined in environment variables.');
}

// ==========================================
// 4. BOT EVENTS & COMMAND HANDLER
// ==========================================

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`Leveling system status: ${levelingEnabled ? 'ENABLED' : 'DISABLED'}`);
});

// Audit Logging Helper
async function logAudit(guild, title, description, color = 0x00FF00) {
    const logChannel = guild.channels.cache.find(c => c.name === 'audit-logs' || c.name === 'mod-logs');
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- LEVELING SYSTEM (XP Processing) ---
    if (levelingEnabled) {
        let userLevel = await Level.findOne({ userId: message.author.id });
        if (!userLevel) {
            userLevel = new Level({ userId: message.author.id, xp: 0, level: 1 });
        }

        const xpGained = Math.floor(Math.random() * 10) + 5;
        userLevel.xp += xpGained;

        const xpNeeded = userLevel.level * 100;
        if (userLevel.xp >= xpNeeded) {
            userLevel.level += 1;
            userLevel.xp = 0;
            message.channel.send(`🎉 Congratulations ${message.author}! You leveled up to **Level ${userLevel.level}**!`);
        }
        await userLevel.save();
    }

    // --- COMMAND HANDLER ---
    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 1. LEVELING TOGGLE COMMAND
    if (command === 'leveling') {
        const subCommand = args[0]?.toLowerCase();

        if (subCommand === 'enable') {
            levelingEnabled = true;
            return message.reply('Leveling system has been **enabled**.');
        } else if (subCommand === 'disable') {
            levelingEnabled = false;
            return message.reply('Leveling system has been **disabled**.');
        } else {
            return message.reply(`Leveling is currently **${levelingEnabled ? 'enabled' : 'disabled'}**. Use \`!leveling enable\` or \`!leveling disable\`.`);
        }
    }

    // 2. DAILY REWARDS
    if (command === 'daily') {
        let userEco = await Economy.findOne({ userId: message.author.id });
        if (!userEco) {
            userEco = new Economy({ userId: message.author.id });
        }

        const now = new Date();
        const cooldown = 24 * 60 * 60 * 1000; // 24 hours

        if (userEco.lastDaily && (now - userEco.lastDaily) < cooldown) {
            const remaining = cooldown - (now - userEco.lastDaily);
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            return message.reply(`⏳ You already claimed your daily reward! Come back in **${hours}h ${minutes}m**.`);
        }

        const reward = 250;
        userEco.balance += reward;
        userEco.lastDaily = now;
        await userEco.save();

        return message.reply(`🪙 You claimed your daily reward of **${reward} coins**! Current Balance: **${userEco.balance}**.`);
    }

    // 3. BALANCE CHECK
    if (command === 'balance' || command === 'bal') {
        let userEco = await Economy.findOne({ userId: message.author.id });
        const balance = userEco ? userEco.balance : 0;
        return message.reply(`💳 You currently have **${balance} coins**.`);
    }

    // 4. MODERATION: BAN
    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply('❌ You do not have permission to ban members.');
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply('Please specify a member to ban.');

        const reason = args.slice(1).join(' ') || 'No reason provided';
        await target.ban({ reason });
        message.reply(`✅ Banned ${target.user.tag} for: ${reason}`);
        logAudit(message.guild, 'Member Banned', `**User:** ${target.user.tag}\n**By:** ${message.author.tag}\n**Reason:** ${reason}`, 0xFF0000);
    }

    // 5. TICKETING SYSTEM
    if (command === 'ticket') {
        const subCommand = args[0]?.toLowerCase();

        if (subCommand === 'create') {
            const ticketId = `ticket-${Date.now().toString().slice(-4)}`;
            const ticketChannel = await message.guild.channels.create({
                name: ticketId,
                permissionOverwrites: [
                    { id: message.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: message.author.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });

            await Ticket.create({
                ticketId,
                channelId: ticketChannel.id,
                userId: message.author.id
            });

            ticketChannel.send(`🎟️ Ticket created by ${message.author}. Describe your issue and support will assist you shortly.`);
            message.reply(`Ticket created: ${ticketChannel}`);
            logAudit(message.guild, 'Ticket Opened', `**Ticket:** ${ticketId}\n**Created By:** ${message.author.tag}`);
        } else if (subCommand === 'close') {
            const ticket = await Ticket.findOne({ channelId: message.channel.id });
            if (!ticket) return message.reply('This is not an active ticket channel.');

            ticket.status = 'CLOSED';
            await ticket.save();
            message.reply('Closing this ticket in 5 seconds...');
            setTimeout(() => message.channel.delete().catch(() => {}), 5000);
            logAudit(message.guild, 'Ticket Closed', `**Ticket Channel ID:** ${message.channel.id}\n**Closed By:** ${message.author.tag}`);
        } else {
            return message.reply('Use `!ticket create` to open a ticket or `!ticket close` inside a ticket channel.');
        }
    }
});

// ==========================================
// 5. BOT LOGIN
// ==========================================
if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN);
} else {
    console.error('DISCORD_TOKEN is missing from environment variables.');
}
