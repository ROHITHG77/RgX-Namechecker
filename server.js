const { Client, Intents, MessageEmbed } = require('discord.js');
const fetch = require('node-fetch');

const bot = new Client({ 
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS
    ]
});

const CONFIG = {
    token: 'YOUR_DISCORD_BOT_TOKEN',
    serverId: 'YOUR_SERVER_ID',
    loggingChannelId: 'LOG_CHANNEL_ID',
    memberFetchTimeout: 10000,
    maxRetries: 3
};

let activeServer = null;
let loggingChannel = null;

async function createLog(messageTitle, messageContent, embedColor) {
    if (!loggingChannel) return;
    const logEmbed = new MessageEmbed()
        .setTitle(messageTitle)
        .setDescription(messageContent)
        .setColor(embedColor)
        .setTimestamp();
    try {
        await loggingChannel.send({ embeds: [logEmbed] });
    } catch (err) {
        console.error('[RgX-NameChecker] Failed to create log:', err);
    }
}

async function getMemberInfo(server, userId) {
    for (let attempt = 0; attempt < CONFIG.maxRetries; attempt++) {
        try {
            const memberData = await Promise.race([
                server.members.fetch(userId),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Request timed out')), CONFIG.memberFetchTimeout)
                )
            ]);
            return memberData;
        } catch (err) {
            if (attempt === CONFIG.maxRetries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
    }
}

bot.on('ready', async () => {
    console.log('[RgX-NameChecker] System initialized');
    try {
        activeServer = await bot.guilds.fetch(CONFIG.serverId);
        loggingChannel = await bot.channels.fetch(CONFIG.loggingChannelId);
        console.log('[RgX-NameChecker] Connected to:', activeServer.name);
        await createLog('System Online', 'RgX-NameChecker verification system is now active', '#00FF00');
    } catch (err) {
        console.error('[RgX-NameChecker] Startup failed:', err);
    }
});

bot.login(CONFIG.token).catch(err => {
    console.error('[RgX-NameChecker] Authentication failed:', err);
});

on('playerConnecting', async (playerName, kickCallback, deferrals) => {
    deferrals.defer();
    deferrals.update('[RgX-NameChecker] Checking Discord verification...');
    
    const player = global.source;
    
    try {
        const ids = getPlayerIdentifiers(player);
        const discordId = ids.find(id => id.startsWith('discord:'))?.split(':')[1];
        
        if (!discordId) {
            console.log(`[RgX-NameChecker] ${playerName} rejected: Missing Discord`);
            await createLog('Access Denied', `${playerName} attempted to join without Discord linked`, '#FF0000');
            deferrals.done('[RgX-NameChecker] Discord account must be linked to FiveM to join this server.');
            return;
        }
        
        if (!activeServer) {
            console.log(`[RgX-NameChecker] ${playerName} rejected: System offline`);
            await createLog('Access Denied', `${playerName} attempted to join while system was offline`, '#FF0000');
            deferrals.done('[RgX-NameChecker] Verification system is currently unavailable. Please try again later.');
            return;
        }
        
        let discordMember;
        try {
            discordMember = await getMemberInfo(activeServer, discordId);
        } catch (err) {
            if (err.message.includes('Unknown Member')) {
                console.log(`[RgX-NameChecker] ${playerName} rejected: Not in Discord server`);
                await createLog('Access Denied', `${playerName} is not a member of the Discord server`, '#FF0000');
                deferrals.done('[RgX-NameChecker] You must be a member of our Discord server to join. Please join and try again.');
            } else {
                console.error(`[RgX-NameChecker] Failed to verify ${discordId}:`, err);
                await createLog('Verification Error', `Failed to verify ${playerName}. Error: ${err.message}`, '#FF0000');
                deferrals.done('[RgX-NameChecker] Unable to verify Discord membership. Please try again later.');
            }
            return;
        }

        if (!discordMember) {
            console.log(`[RgX-NameChecker] ${playerName} rejected: Not in Discord`);
            await createLog('Access Denied', `${playerName} is not a Discord member`, '#FF0000');
            deferrals.done('[RgX-NameChecker] You must join our Discord server before connecting.');
            return;
        }
        
        const discordName = discordMember.nickname || discordMember.user.username;
        
        if (playerName !== discordName) {
            console.log(`[RgX-NameChecker] Name mismatch - FiveM: ${playerName}, Discord: ${discordName}`);
            await createLog('Name Mismatch', `Attempted connection with different names:\nFiveM: ${playerName}\nDiscord: ${discordName}`, '#FFA500');
            deferrals.done(`[RgX-NameChecker] Your FiveM name must match your Discord name (${discordName}) exactly.`);
            return;
        }
        
        console.log(`[RgX-NameChecker] Verified ${playerName}`);
        await createLog('Access Granted', `${playerName} successfully verified and connected`, '#00FF00');
        deferrals.done();
    } catch (err) {
        console.error('[RgX-NameChecker] System error:', err);
        await createLog('System Error', `Error verifying ${playerName}: ${err.message}`, '#FF0000');
        deferrals.done('[RgX-NameChecker] Verification error occurred. Please try again later.');
    }
});

on('playerDropped', async (reason) => {
    const player = global.source;
    const playerName = GetPlayerName(player);
    
    console.log(`[RgX-NameChecker] Disconnection: ${playerName} (${reason})`);
    await createLog('Player Left', `Player: ${playerName}\nReason: ${reason}`, '#FFA500');
});
