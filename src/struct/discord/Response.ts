import { hexToRGB } from "@buildtheearth/bot-utils"
import Discord from "discord.js"
import Client from "../Client.js"
import CommandMessage from "../CommandMessage.js"

export default class Response {
    client: Client

    constructor(client: Client) {
        this.client = client
    }

    async sendError(
        message: CommandMessage | Discord.TextBasedChannel,
        embed: string | Discord.MessageEmbedOptions,
        ephemeral: boolean = true
    ): Promise<CommandMessage | void> {
        if (typeof embed === "string") embed = { description: embed }
        embed.color = hexToRGB(this.client.config.colors.error)
        if (message instanceof CommandMessage)
            return message.send({ embeds: [embed], ephemeral: ephemeral })
        else
            return new CommandMessage(
                await message.send({ embeds: [embed] }),
                this.client
            )
    }

    async sendSuccess(
        message: CommandMessage | Discord.TextBasedChannel,
        embed: string | Discord.MessageEmbedOptions,
        ephemeral: boolean = false
    ): Promise<CommandMessage | void> {
        if (typeof embed === "string") embed = { description: embed }
        embed.color = hexToRGB(this.client.config.colors.success)
        if (message instanceof CommandMessage)
            return message.send({ embeds: [embed], ephemeral: ephemeral })
        else
            return new CommandMessage(
                await message.send({ embeds: [embed] }),
                this.client
            )
    }
}
