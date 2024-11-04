import { Events, GatewayIntentBits, TextChannel} from "discord.js";
import 'dotenv/config';
import { loadEvents, loadSlashCommands } from './utils/utils.js'
import { glob } from "glob";
import CustomClient from "./types/custom-client";
import mongoose from "mongoose";
import env from "./load-env";
import { refreshUsersCache } from "./cache";


/*

Discord

Resources:

https://discordjs.guide/#before-you-begin
https://discordjs.guide/creating-your-bot/command-deployment.html#guild-commands


*/


export let discordLoggingChannel: TextChannel | null;


const token = env.DISCORD_APP_TOKEN
const CACHE_UPDATE_INTERVAL_SECONDS = 30

const client = new CustomClient({intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.MessageContent,
	GatewayIntentBits.GuildMembers,
]});

mongoose.connection.once('open', async function() {
	console.log(`MongoDB/Mongoose connection established successfully.`)
})

async function main() {
	await mongoose.connect(env.MONGO_DB_URL)
	const commandFiles = await glob(`${__dirname}/commands/*/*{.ts,.js}`, { windowsPathsNoEscape: true })
	const eventFiles = await glob(`${__dirname}/events/*{.ts,.js}`, { windowsPathsNoEscape: true })
	const events = await loadEvents(eventFiles)
	client.commands = await loadSlashCommands(commandFiles)

	await refreshUsersCache()

	// Periodically update the state of the cache
	setInterval(refreshUsersCache, CACHE_UPDATE_INTERVAL_SECONDS * 1000)

	for (const event of events) {
		if (event.once) {
			// @ts-ignore
			client.once(event.name, (...args) => event.execute(...args, client))
		} else {
			// @ts-ignore
			client.on(event.name, (...args) => event.execute(...args, client));
		}
	}


	client.once(Events.ClientReady, async readyClient => {
		console.log(`Ready! Logged in as ${readyClient.user.tag}`);

		// This is admittedly some pretty dirty code, but ensures that logging is only active if the channel is valid
		if (env.DISCORD_LOGGING_CHANNEL_ID) {
			try {
				const channel = await client.channels.fetch(env.DISCORD_LOGGING_CHANNEL_ID)
				if (channel) {
					discordLoggingChannel = ( channel as TextChannel )
				}
			} catch (e) {
				console.error(`Error when attempting to fetch logging channel`)
				console.error(e)
			}
		}
	});


	await client.login(token);
}



main()