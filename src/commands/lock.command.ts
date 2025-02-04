import Client from "../struct/Client.js"
import Args from "../struct/Args.js"
import Command from "../struct/Command.js"

import Discord from "discord.js"
import ApiTypes = require("discord-api-types/v10")
import CommandMessage from "../struct/CommandMessage.js"
import { hexToNum } from "@buildtheearth/bot-utils"

export default new Command({
    name: "lock",
    aliases: [],
    description: "Lock the channel.",
    permission: globalThis.client.roles.MANAGER,
    args: [
        {
            name: "channel",
            description: "The channel to lock",
            required: false,
            optionType: "CHANNEL",
            channelTypes: [ApiTypes.ChannelType.GuildText]
        }
    ],
    async run(this: Command, client: Client, message: CommandMessage, args: Args) {
        const channel =
            ((await args.consumeChannel("channel")) as Discord.TextChannel) ||
            (message.channel as Discord.TextChannel)

        const reason = `Locked by ${message.member.user.tag} (${message.member.id})`

        await channel.permissionOverwrites.edit(
            message.guild.id,
            {
                SendMessages: false
            },
            { reason: reason }
        )

        await message.sendSuccessMessage("lockedChannel", channel)
        await client.log({
            color: hexToNum(client.config.colors.error),
            author: { name: "Locked" },
            description: `Channel ${channel} locked by ${message.member}.`
        })
    }
})
