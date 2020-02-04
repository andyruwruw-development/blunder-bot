var Discord = require('discord.io');
var logger = require('winston');
var axios = require('axios');
let dotenv = require('dotenv');
dotenv.config();
let discordToken = process.env.discordToken;


logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

let discord = axios.create({
    headers: {
        common: {        // can be common or any other method
            Authorization: 'Bot ' + discordToken,
        }
    }
});

var bot = new Discord.Client({
   token: discordToken,
   autorun: true
});

bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});

// THINGS TO WORK ON
    // DELETE USER MADE MESSAGES IN ARCHIVE
    // CHECK CHANNEL FOR COMMANDS
    // VIEW GAMES
    // TRACK GAMES

bot.on('message', async function (user, userID, channelID, message, evt) {

    let check = () => {
        bot.sendMessage({
            to: channelID,
            message: 'MATE!'
        });
    };

    let setup = async() => {
        let catagoryIDs = await createCategories();
        await createChannels(catagoryIDs);
    }

    let createCategories = async () => {
        let catagoryIDs = {};
        let categories = {
            '\u265F General': {present: false, topic: "General Channels.", position: 1},
            '\u2656 Archive': {present: false, topic: "Stores relevent data to users and past games. View old games or stats.", position: 3},
            '\u265A Active Games': {present: false, topic: "Text channels and live updates from tracked games.", position: 2},
        };
        for (let [id, value] of Object.entries(bot.channels)) 
            for (let key of Object.keys(categories)) 
                if (value.name == key) {
                    categories[key].present = true;
                    catagoryIDs[key] = value.id;
                } 
        let serverID;
        for (let key of Object.keys(categories)) {
            if (!categories[key].present) {
                if (!serverID)
                    for (let [key, value] of Object.entries(bot.channels)) 
                        if (key == channelID) {
                            serverID = value.guild_id;
                            break;
                        }
                try {
                    catagoryIDs[key] = (await discord.post('https://discordapp.com/api/guilds/' + serverID + '/channels', {
                        name: key,
                        type: 4,
                        topic: categories[key].topic,
                        rate_limit_per_user: 0,
                        position: 0,
                        permission_overwrites: [],
                        parent_id: null,
                        nsfw: false,
                    })).id
                } catch(error) {
                    console.log(error);
                    await bot.sendMessage({to: channel.id, message: 'Failed to create category'});
                }
            }
        } 
        return catagoryIDs;
    }

    let createChannels = async (categoryIDs) => {
        let channels = {
            // welcome -> text chat
            '\u265F General': [
                {
                    name: "general",
                    type: 0,
                    topic: "General chat.",
                    position: 0,
                },
                {
                    name: "leaderboards",
                    type: 0,
                    topic: "General chat.",
                    position: 1,
                },
                // discussion -> voice chat.
            ],
            '\u2656 Archive': [
                {
                    name: "access archives",
                    type: 0,
                    topic: "View Archive Data.",
                    position: 0,
                },
                {
                    name: "game archive",
                    type: 0,
                    topic: "Blunder Bot's chat for storing game data.",
                    position: 1,
                },
                {
                    name: "profiles archive",
                    type: 0,
                    topic: "Blunder Bot's chat for storing user information (win / loss rate)",
                    position: 2,
                },
            ],
            '\u265A Active Games': [
                {
                    name: "lobby",
                    type: 0,
                    topic: "Start games and tournaments.",
                    position: 2,
                },
            ],
        };

        let serverID;
        for (let [key, value] of Object.entries(bot.channels)) 
            if (key == channelID) {
                serverID = value.guild_id;
                break;
            }

        for (let category of Object.keys(channels)) {
            for (let channel of Object.keys(channels[category])) {
                let exists = false;
                for (let [key, value] of Object.entries(bot.channels)) 
                    if (value.name == channel.name && value.type == channel.type && value.guild_id == serverID) exists = true;
                if (exists) continue;
                try {
                    await discord.post('https://discordapp.com/api/guilds/' + serverID + '/channels', {
                        name: channel.name,
                        type: channel.type,
                        topic: channel.topic,
                        rate_limit_per_user: 0,
                        position: channel.position,
                        permission_overwrites: [],
                        parent_id: categoryIDs[category],
                        nsfw: false,
                    });
                } catch(error) {
                    console.log(error);
                    await bot.sendMessage({to: channel.id, message: 'Failed to create text channel.'});
                }
            }
        }
        try {
            await discord.post('https://discordapp.com/api/guilds/' + serverID + '/channels', {
                name: 'welcome',
                type: 0,
                topic: "Introduce people to the server",
                rate_limit_per_user: 0,
                position: 0,
                permission_overwrites: [],
                parent_id: null,
                nsfw: false,
            });
        } catch(error) {
            console.log(error);
            await bot.sendMessage({to: channel.id, message: 'Failed to create welcome channel.'});
        }
        try {
            await discord.post('https://discordapp.com/api/guilds/' + serverID + '/channels', {
                name: 'discussion',
                type: 2,
                topic: "Voice channel for server.",
                position: 2,
                permission_overwrites: [],
                parent_id: categoryIDs['\u265F General'],
                nsfw: false,
            });
        } catch(error) {
            console.log(error);
            await bot.sendMessage({to: channel.id, message: 'Failed to create .voice channel'});
        }
    }

    let game = async (args) => {
        // Check command has correct arguments
        if (args.length < 2) {
            await bot.sendMessage({to: channelID, message: 'Blunder.\nTry `bb!game <player1> <player2> <gameID>`.'});
            return;
        }
        
        // Get server ID from channels
        let serverID;
        for (let [key, value] of Object.entries(bot.channels)) 
            if (key == channelID) {
                serverID = value.guild_id;
                break;
            }

        // Retrieve games from player 1
        let games
        try {
            let response = await axios.get('https://api.chess.com/pub/player/' + args[0] + '/games');
            games = response.data.games;
        } catch(error) {
            // Chess.com returned error.
            await bot.sendMessage({to: channelID, message: 'Blunder.\nUser not found.'});
            return;
        }

        // Set Game ID
        let gameID;
        if (args.length > 2) gameID = args[2];
        else { 
            // Find GameID if not provided
            let found = 0;
            for (let i = 0; i < games.length; i++) {
                let white = games[i].white.substring(33, games[i].white.length).toLowerCase();
                console.log(white);
                let black = games[i].black.substring(33, games[i].black.length).toLowerCase();
                console.log(black);
                if ((white == args[0].toLowerCase() && black == args[1].toLowerCase()) || (white == args[1].toLowerCase() && black == args[0].toLowerCase())) {
                    found += 1;
                    gameID = games[i].url.substring(games[i].url.length - 9, games[i].url.length);
                    console.log(games[i].url);
                }
            }
            // More than 1 Game Active between users.
            if (found > 1) {
                await bot.sendMessage({to: channelID, message: 'You both have more than 1 game currently active.\nPlease clarify game ID in command.\n`bb!game <player1> <player2> <gameID>\n'});
                return;
            }
        }   

        // Name of Channel
        let name = args[0] + ' vs. ' + args[1] + ' | ' + gameID;

        // Create New Channel
        try {
            let categoryID;
            while (categoryID == null) {
            for (let [key, value] of Object.entries(bot.channels)) {
                if (value.name == "\u265A Active Games" && value.type == 4 && value.guild_id == serverID) {
                    categoryID = key;
                    break;
                }
            }
            if (!categoryID) await createCategories();
            }
            console.log('channelID', channelID);
            let now = new Date();
            let channel;
            try {
                channel = await discord.post('https://discordapp.com/api/guilds/' + serverID + '/channels', {
                    name: name,
                    type: 0,
                    topic: 'Game between ' + args[0] + ' and ' + args[1] + '. Started ' + (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getUTCFullYear(),
                    rate_limit_per_user: 0,
                    position: 1,
                    permission_overwrites: [],
                    parent_id: categoryID,
                    nsfw: false,
                });
            } catch(error) {
                console.log(error);
                await bot.sendMessage({to: channelID, message: 'Error creating channel!\n'});
                return;
            }
            await bot.sendMessage({to: channel.id, message: '**' + args[0].toUpperCase() + ' VS ' + args[1].toUpperCase() + '**'});
        } catch(error) {
            console.log(error);
        }
    };

    let help = async () => {
        // Will Fix Formating
        // Do Last
        await bot.sendMessage({to: channelID, message: 'Discoveries:\n`!help` - for BlunderBot Commands.\n`!game <player1> <player2> <gameID>` - Start tracking a game. GameID is in the URL or '});
    }

    let invalid = async () => {
        await bot.sendMessage({to: channelID, message: 'That\'s a Blunder.\nTry `!help` for options.'});
    };

    if (message.substring(0, 3) == 'bb!') {
        var args = message.substring(3).split(' ');
        var cmd = args[0];
        args = args.splice(1);

        switch(cmd) {
            // bb!check
            // Says Mate
            case 'check':
                check();
                break;
            // bb!setup
            // Formats Server
            case 'setup':
                setup();
                break;
            // bb!game <player_name> <player_name> <gameID>
            // Creates new channel for tracking and talking about game
            // Displays results and saves them to database.
            case 'game':
                game(args);
                break;
            // bb!help
            // Says Instructions
            case 'help':
                help();
                break;
            // bb!player <player_name>
            // Displays win loss ratio to other players
            case 'player':
                help();
                break;
            // bb!archive <player_name> <index>
            // Shows all games by player
            case 'archive':
                help();
                break;
            // bb!tournament <player_names>
            // Starts new channels for tournament
            case 'tournament':
                help();
                break;
            // bb!*
            default: 
                invalid();
                break;

         }
     }
});


