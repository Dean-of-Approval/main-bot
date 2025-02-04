import Discord from "discord.js"
import Client from "../struct/Client.js"
import Args from "../struct/Args.js"
import Command from "../struct/Command.js"

import ActionLog, { Action } from "../entities/ActionLog.entity.js"
import TimedPunishment from "../entities/TimedPunishment.entity.js"
import ModerationNote from "../entities/ModerationNote.entity.js"
import typeorm from "typeorm"
import CommandMessage from "../struct/CommandMessage.js"
import { noop } from "@buildtheearth/bot-utils"

export default new Command({
    name: "check",
    aliases: [],
    description: "Check a user's punishment records.",
    permission: [
        globalThis.client.roles.HELPER,
        globalThis.client.roles.MODERATOR,
        globalThis.client.roles.MANAGER,
        globalThis.client.roles.SUPPORT,
        globalThis.client.roles.PR_SUBTEAM_LEADS
    ],
    args: [
        {
            name: "user",
            description: "User to get records of",
            optionType: "USER",
            required: true
        },
        {
            name: "deleted",
            description: "Optional arg to check for deleted cases",
            optionType: "BOOLEAN",
            required: false
        }
    ],
    async run(this: Command, client: Client, message: CommandMessage, args: Args) {
        const user = await args.consumeUser("user")

        if (!user)
            return message.sendErrorMessage(user === undefined ? "noUser" : "invalidUser")

        const showDeleted = args.consumeBoolean("deleted")
        const member = await (await client.customGuilds.main()).members
            .fetch({ user })
            .catch(noop)

        if (!user)
            return message.sendErrorMessage(user === undefined ? "noUser" : "invalidUser")

        let criteria: typeorm.FindManyOptions<ActionLog> = { where: { member: user.id } }
        if (showDeleted) {
            criteria = {
                where: {
                    member: user.id,
                    deletedAt: typeorm.Not<ActionLog>(typeorm.IsNull())
                }
            }

            criteria.withDeleted = true
        }

        await message.continue()

        const actionLogs = await ActionLog.find(criteria)
        const categorizedLogs: Record<Action, ActionLog[]> = {
            warn: [],
            mute: [],
            kick: [],
            ban: [],
            unmute: [],
            unban: []
        }

        const clean = !actionLogs.length
        for (const log of actionLogs) categorizedLogs[log.action].push(log)

        const embed: Discord.APIEmbed = {
            thumbnail: {
                url: user.displayAvatarURL({
                    size: 64,
                    extension: "png",
                    forceStatic: false
                })
            },
            fields: []
        }

        if (clean) {
            embed.description = ` No cases found for ${user} (${user.tag}).`
        } else {
            const current = await TimedPunishment.findOne({
                where: { member: user.id },
                order: { type: "ASC" } // make "ban" take precedence over "mute"
            })
            const currentLog = actionLogs.find(log => log.punishment?.id === current?.id)
            const adjective = current?.type === "mute" ? "muted" : "banned"
            const cases = showDeleted ? "Deleted cases" : "Cases"
            const attribute = showDeleted ? " deleted " : " "

            embed.description =
                current && currentLog
                    ? `${user} (${user.tag}) is currently ${adjective} (**#${currentLog.id}**). Here are their${attribute}cases:`
                    : `${cases} for ${user} (${user.tag}):`
            if (actionLogs.some(log => log.old))
                embed.description += "\n(Cases older than 3 months are marked with \\📜)."

            for (const [action, logs] of Object.entries(categorizedLogs)) {
                const actionTitle = action[0].toUpperCase() + action.slice(1) + "s"
                const name = `${actionTitle} (${logs.length})`
                const value = logs.map(log => log.format()).join("\n") || "\u200B"
                embed.fields?.push({ name, value, inline: true })
            }
        }

        const notes = await ModerationNote.findOne(user.id)
        if (notes) embed.fields?.push({ name: "Notes", value: notes.body, inline: true })
        if (!member) embed.footer = { text: "This user is not in the server." }

        await message.sendSuccess(embed)
    }
})
