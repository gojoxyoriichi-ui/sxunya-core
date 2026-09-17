require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder 
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');

// --- EXPRESS WEB SERVER FOR 24/7 HOSTING ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Sxunya Core Bot is online and operational!');
});

app.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});

// --- DISCORD CLIENT INITIALIZATION ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Configuration
const CHAT_CHANNEL_ID = '1502599926893514843'; // Channel where messages add clan points
const DATA_FILE = path.join(__dirname, 'clans.json');

// --- JSON FILE DATABASE FUNCTIONS ---
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { clans: {}, userClanMap: {} };
  }
  try {
    const rawData = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(rawData);
  } catch (err) {
    console.error('Error loading database file, starting clean:', err);
    return { clans: {}, userClanMap: {} };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

// Load existing data into memory
let db = loadData();

// Ready Event
client.on('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}! Clan system active.`);
});

// Helper Function: Find Clan Key robustly regardless of case or trailing spaces
function findClanKey(input) {
  if (!input) return null;
  const cleanInput = input.trim().toLowerCase();
  return Object.keys(db.clans).find(
    key => key === cleanInput || db.clans[key].name.trim().toLowerCase() === cleanInput
  ) || null;
}

// --- MAIN MESSAGE & COMMAND HANDLER ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = '!';
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ---------------- HELPMENU ----------------
    if (command === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setTitle('🛡️ Clan System Commands')
        .setColor('#5865F2')
        .addFields(
          { name: '!createclan <name> | <quote> | [@owner]', value: 'Create a new clan (Creates role & assigns owner).' },
          { name: '!joinclan <clan_name>', value: 'Join an existing clan.' },
          { name: '!leaveclan', value: 'Leave your current clan.' },
          { name: '!clandelete', value: 'Disband your clan and remove its role (Owner only).' },
          { name: '!clanprofile [clan_name]', value: 'View clan profile, quote, points, and members.' },
          { name: '!addclanprofile <image_url_or_attachment>', value: 'Update clan profile image (Owner only).' },
          { name: '!kickclan <@member>', value: 'Kick a member from your clan (Owner only).' },
          { name: '!clanstats', value: 'Check your clan statistics.' },
          { name: '!clanleaderboard', value: 'View top clans ranked by points.' }
        )
        .setTimestamp();

      return message.channel.send({ embeds: [helpEmbed] });
    }

    // ---------------- CREATE CLAN ----------------
    if (command === 'createclan') {
      const fullArgs = args.join(' ').split('|').map(a => a.trim());
      const clanName = fullArgs[0];
      const clanQuote = fullArgs[1] || 'No quote set.';
      const ownerMention = message.mentions.members.first() || message.member;

      if (!clanName) {
        return message.reply('❌ Usage: `!createclan <Clan Name> | <Clan Quote> | [@Owner]`');
      }

      const clanKey = clanName.toLowerCase();
      if (db.clans[clanKey] || findClanKey(clanName)) {
        return message.reply('❌ A clan with that name already exists!');
      }

      if (db.userClanMap[ownerMention.id]) {
        return message.reply(`❌ ${ownerMention.user.tag} is already in a clan.`);
      }

      try {
        const clanRole = await message.guild.roles.create({
          name: clanName,
          reason: `Clan role created for ${clanName}`,
        });

        await ownerMention.roles.add(clanRole);

        const defaultPfp = ownerMention.user.displayAvatarURL({ dynamic: true });
        
        db.clans[clanKey] = {
          name: clanName,
          quote: clanQuote,
          ownerId: ownerMention.id,
          roleId: clanRole.id,
          pfp: defaultPfp,
          points: 0,
          members: [ownerMention.id],
        };
        db.userClanMap[ownerMention.id] = clanKey;

        saveData(db);

        const embed = new EmbedBuilder()
          .setTitle(`⚔️ Clan Created: ${clanName}`)
          .setDescription(`**Quote:** "${clanQuote}"\n**Owner:** ${ownerMention.user}`)
          .setThumbnail(defaultPfp)
          .setColor('#57F287');

        return message.channel.send({ embeds: [embed] });
      } catch (err) {
        console.error(err);
        return message.reply('❌ Failed to create clan role. Ensure I have the `Manage Roles` permission.');
      }
    }

    // ---------------- JOIN CLAN ----------------
    if (command === 'joinclan') {
      const inputName = args.join(' ').trim();
      if (!inputName) return message.reply('❌ Please specify a clan name to join!');

      if (db.userClanMap[message.author.id]) {
        return message.reply('❌ You are already in a clan. Leave your current clan first using `!leaveclan`.');
      }

      const clanKey = findClanKey(inputName);

      if (!clanKey || !db.clans[clanKey]) {
        return message.reply(`❌ Clan **"${inputName}"** not found! Check spelling or use \`!clanleaderboard\` to check existing clans.`);
      }

      const clan = db.clans[clanKey];
      clan.members.push(message.author.id);
      db.userClanMap[message.author.id] = clanKey;

      saveData(db);

      const role = message.guild.roles.cache.get(clan.roleId);
      if (role) await message.member.roles.add(role).catch(() => {});

      return message.reply(`🎉 You have successfully joined **${clan.name}**!`);
    }

    // ---------------- LEAVE CLAN ----------------
    if (command === 'leaveclan') {
      const clanKey = db.userClanMap[message.author.id];
      if (!clanKey) return message.reply('❌ You are not in any clan.');

      const clan = db.clans[clanKey];
      if (clan.ownerId === message.author.id) {
        return message.reply('❌ Clan owners cannot leave their own clan! Disband it using `!clandelete`.');
      }

      clan.members = clan.members.filter(id => id !== message.author.id);
      delete db.userClanMap[message.author.id];

      saveData(db);

      const role = message.guild.roles.cache.get(clan.roleId);
      if (role) await message.member.roles.remove(role).catch(() => {});

      return message.reply(`🚪 You left **${clan.name}**.`);
    }

    // ---------------- DELETE CLAN (OWNER ONLY) ----------------
    if (command === 'clandelete') {
      const clanKey = db.userClanMap[message.author.id];
      if (!clanKey) return message.reply('❌ You are not in any clan!');

      const clan = db.clans[clanKey];
      if (clan.ownerId !== message.author.id) {
        return message.reply('❌ Only the Clan Owner can delete the clan!');
      }

      const clanName = clan.name;

      // Clean up member maps
      for (const memberId of clan.members) {
        delete db.userClanMap[memberId];
      }

      // Delete Clan Role from Guild
      const role = message.guild.roles.cache.get(clan.roleId);
      if (role) {
        await role.delete(`Clan ${clanName} deleted by owner.`).catch(() => {});
      }

      // Delete Clan from Database
      delete db.clans[clanKey];
      saveData(db);

      return message.reply(`💥 Clan **${clanName}** has been completely deleted and its role removed.`);
    }

    // ---------------- CLAN PROFILE ----------------
    if (command === 'clanprofile') {
      const inputName = args.join(' ').trim();
      let clanKey = inputName ? findClanKey(inputName) : db.userClanMap[message.author.id];

      if (!clanKey || !db.clans[clanKey]) {
        return message.reply('❌ Clan not found! Specify a valid clan name or join one.');
      }

      const clan = db.clans[clanKey];
      const memberList = clan.members.map(id => `<@${id}>`).join(', ');

      const embed = new EmbedBuilder()
        .setTitle(`🛡️ Clan Profile: ${clan.name}`)
        .setThumbnail(clan.pfp)
        .setColor('#FEE75C')
        .addFields(
          { name: '💬 Quote', value: clan.quote },
          { name: '👑 Owner', value: `<@${clan.ownerId}>`, inline: true },
          { name: '🏆 Points', value: `${clan.points}`, inline: true },
          { name: '👥 Members Count', value: `${clan.members.length}`, inline: true },
          { name: '📜 Members List', value: memberList || 'No members' }
        );

      return message.channel.send({ embeds: [embed] });
    }

    // ---------------- ADD CLAN PROFILE (PFP) ----------------
    if (command === 'addclanprofile') {
      const clanKey = db.userClanMap[message.author.id];
      if (!clanKey) return message.reply('❌ You are not in a clan!');

      const clan = db.clans[clanKey];
      if (clan.ownerId !== message.author.id) {
        return message.reply('❌ Only the Clan Owner can change the clan profile picture!');
      }

      const newPfp = message.attachments.first()?.url || args[0];
      if (!newPfp) {
        return message.reply('❌ Attach an image or provide a valid image URL!');
      }

      clan.pfp = newPfp;
      saveData(db);

      return message.reply('✅ Clan profile picture updated successfully!');
    }

    // ---------------- KICK MEMBER ----------------
    if (command === 'kickclan') {
      const clanKey = db.userClanMap[message.author.id];
      if (!clanKey) return message.reply('❌ You are not in a clan!');

      const clan = db.clans[clanKey];
      if (clan.ownerId !== message.author.id) {
        return message.reply('❌ Only the Clan Owner can kick members!');
      }

      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ Mention a user to kick from the clan.');

      if (target.id === clan.ownerId) {
        return message.reply('❌ You cannot kick yourself from your clan!');
      }

      if (!clan.members.includes(target.id)) {
        return message.reply('❌ That user is not in your clan.');
      }

      clan.members = clan.members.filter(id => id !== target.id);
      delete db.userClanMap[target.id];

      saveData(db);

      const role = message.guild.roles.cache.get(clan.roleId);
      if (role) await target.roles.remove(role).catch(() => {});

      return message.reply(`✅ Successfully kicked **${target.user.tag}** from **${clan.name}**.`);
    }

    // ---------------- CLAN STATS ----------------
    if (command === 'clanstats') {
      const clanKey = db.userClanMap[message.author.id];
      if (!clanKey) return message.reply('❌ You are not currently in a clan.');

      const clan = db.clans[clanKey];

      const statsEmbed = new EmbedBuilder()
        .setTitle(`📊 Stats for ${clan.name}`)
        .setThumbnail(clan.pfp)
        .setColor('#3498DB')
        .addFields(
          { name: 'Points Earned', value: `${clan.points} PTS`, inline: true },
          { name: 'Total Members', value: `${clan.members.length}`, inline: true },
          { name: 'Role', value: `<@&${clan.roleId}>`, inline: true }
        );

      return message.channel.send({ embeds: [statsEmbed] });
    }

    // ---------------- CLAN LEADERBOARD ----------------
    if (command === 'clanleaderboard') {
      const clanList = Object.values(db.clans);
      if (clanList.length === 0) return message.reply('❌ No clans exist yet!');

      const sortedClans = clanList
        .sort((a, b) => b.points - a.points)
        .slice(0, 10);

      const lbDescription = sortedClans
        .map((c, index) => `**#${index + 1} ${c.name}** — ${c.points} PTS (${c.members.length} members)`)
        .join('\n');

      const lbEmbed = new EmbedBuilder()
        .setTitle('🏆 Clan Leaderboard')
        .setDescription(lbDescription || 'No data available.')
        .setColor('#F1C40F')
        .setTimestamp();

      return message.channel.send({ embeds: [lbEmbed] });
    }
  }

  // --- POINT ACCUMULATION LOGIC ---
  if (message.channel.id === CHAT_CHANNEL_ID) {
    const userClanKey = db.userClanMap[message.author.id];
    if (userClanKey && db.clans[userClanKey]) {
      db.clans[userClanKey].points += 1;
      saveData(db);
    }
  }
});

client.login(process.env.DISCORD_TOKEN || 'YOUR_DISCORD_BOT_TOKEN');