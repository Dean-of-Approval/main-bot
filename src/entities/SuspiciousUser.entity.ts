import typeorm from "typeorm"
import Discord, { ButtonBuilder } from "discord.js"
import Client from "../struct/Client.js"
import { hexToNum, noop } from "@buildtheearth/bot-utils"
import SnowflakeColumn from "./decorators/SnowflakeColumn.decorator.js"
import GuildMember from "../struct/discord/GuildMember.js"
import CommandMessage from "../struct/CommandMessage.js"
import unicode from "./transformers/unicode.transformer.js"
import { discordEpoch } from "../util/discordEpoch.js"

@typeorm.Entity({ name: "suspicious_users" })
export default class SuspiciousUser extends typeorm.BaseEntity {
    @typeorm.PrimaryGeneratedColumn()
    id!: number

    @SnowflakeColumn()
    userId!: string

    @SnowflakeColumn()
    submitterId!: string

    @SnowflakeColumn()
    messageId!: string

    @typeorm.Column({ default: false })
    denied!: boolean

    @typeorm.Column({ default: false })
    approved!: boolean

    @SnowflakeColumn({ nullable: true, default: null })
    moderatorId?: string

    @typeorm.Column({ nullable: true, default: null, type: "text", transformer: unicode })
    reason?: string

    @typeorm.Column({ type: "text", transformer: unicode })
    evidence!: string

    @typeorm.DeleteDateColumn()
    deletedAt?: Date

    @SnowflakeColumn({ nullable: true, default: null })
    threadId?: string

    public static async fetchChannel(
        client: Client
    ): Promise<Discord.TextChannel | null> {
        const channelID = client.config.suspiciousUsers
        const channel = await client.channels.fetch(channelID).catch(noop)
        if (channel?.type === Discord.ChannelType.GuildText) {
            return channel as Discord.TextChannel
        }
        return null
    }

    private async fetchMessage(client: Client): Promise<Discord.Message | null> {
        const channel = await SuspiciousUser.fetchChannel(client)
        if (channel) {
            return channel.messages.fetch(this.messageId).catch(noop)
        }
        return null
    }

    private async fetchUser(client: Client): Promise<Discord.User | null> {
        const user = await client.users.fetch(this.userId).catch(noop)
        return user
    }

    private async fetchThread(client: Client): Promise<Discord.ThreadChannel | null> {
        const channel = await SuspiciousUser.fetchChannel(client)
        if (channel && this.threadId) {
            return channel.threads.fetch(this.threadId).catch(noop)
        }
        return null
    }

    private async fetchSubmitter(client: Client): Promise<Discord.User | null> {
        const user = await client.users.fetch(this.submitterId).catch(noop)
        return user
    }

    private async updateSubmitter(
        client: Client,
        payload: Discord.MessageOptions
    ): Promise<void> {
        const user = await this.fetchSubmitter(client)
        if (user) {
            await user.send(payload).catch(noop)
        }
        const thread = await this.fetchThread(client)
        if (thread) {
            await thread.send(payload).catch(noop)
            await thread.setLocked(true).catch(noop)
            await thread.setArchived(true).catch(noop)
        }
    }

    private async denySubmitter(client: Client): Promise<void> {
        await this.updateSubmitter(client, {
            embeds: [
                {
                    title: "Suspicious User Denied",
                    description: `Your suspicious user has been denied.\nReason: ${this.reason}`,
                    color: hexToNum(client.config.colors.error),
                    timestamp: discordEpoch(new Date())
                }
            ]
        }).catch(noop)
    }

    private async acceptSubmitter(client: Client): Promise<void> {
        await this.updateSubmitter(client, {
            embeds: [
                {
                    title: "Suspicious User Accepted",
                    description: `Your suspicious user has been accepted.\nReason: ${this.reason}`,
                    color: hexToNum(client.config.colors.success),
                    timestamp: discordEpoch(new Date())
                }
            ]
        }).catch(noop)
    }

    createEmbed(): Discord.MessageOptions {
        const embed = <Discord.APIEmbed>{
            title: "Suspicious User Report",
            fields: [
                {
                    name: "User",
                    value: `<@${this.userId}> (${this.userId})`,
                    inline: false
                },
                {
                    name: "Reporter",
                    value: `<@${this.submitterId}> (${this.submitterId})`,
                    inline: false
                },
                {
                    name: "Evidence",
                    value: this.evidence,
                    inline: false
                }
            ],
            color: hexToNum(client.config.colors.info)
        }

        if (this.denied) {
            embed.color = hexToNum(client.config.colors.error)
            embed.fields?.push({
                name: "Denied",
                value: `Denied by <@${this.moderatorId}> (${this.moderatorId}) for reason: ${this.reason}`
            })
        }

        if (this.approved) {
            embed.color = hexToNum(client.config.colors.success)
            embed.fields?.push({
                name: "Approved",
                value: `Approved by <@${this.moderatorId}> (${this.moderatorId}) for reason: ${this.reason}`
            })
        }

        const options: Discord.MessageOptions = { embeds: [embed], components: [] }

        if (!(this.approved || this.denied)) {
            const actionRow = new Discord.ActionRowBuilder<ButtonBuilder>()
            const approvedButton: Discord.InteractionButtonComponentData = {
                style: Discord.ButtonStyle.Primary,
                customId: `suspicious_user.${this.id}.approved`,
                label: "Approve",
                type: Discord.ComponentType.Button
            }
            const deniedButton: Discord.InteractionButtonComponentData = {
                style: Discord.ButtonStyle.Danger,
                customId: `suspicious_user.${this.id}.denied`,
                label: "Deny",
                type: Discord.ComponentType.Button
            }
            actionRow.addComponents([
                new Discord.ButtonBuilder(approvedButton),
                new Discord.ButtonBuilder(deniedButton)
            ])
            options.components?.push(actionRow)
        }

        return options
    }

    createEditEmbed(): Discord.MessageEditOptions {
        return this.createEmbed() as Discord.MessageEditOptions
    }

    public static async createReport(
        client: Client,
        user: string,
        submitter: string,
        evidence: string
    ): Promise<SuspiciousUser | null> {
        const sususer = new SuspiciousUser()
        sususer.userId = user
        sususer.submitterId = submitter
        sususer.evidence = evidence

        const channel = await SuspiciousUser.fetchChannel(client)
        if (channel) {
            sususer.messageId = ""
            sususer.threadId = ""
            await sususer.save()
            const message = await channel.send(sususer.createEmbed())
            sususer.messageId = message.id
            if (message && channel.type === Discord.ChannelType.GuildText) {
                sususer.threadId = (
                    await message.startThread({
                        name: `Suspicious User Report: ${sususer.id}`,
                        autoArchiveDuration: Discord.ThreadAutoArchiveDuration.OneWeek
                    })
                ).id
            } else {
                return null
            }
        } else {
            return null
        }

        await sususer.save()
        return sususer
    }

    async acceptReport(moderator: string, reason: string): Promise<void> {
        this.approved = true
        this.moderatorId = moderator
        this.reason = reason
        await this.save()
        const message = await this.fetchMessage(client)
        if (message) {
            await message.edit(this.createEditEmbed())
        }
        await this.acceptSubmitter(client)
        await this.softRemove()
    }

    async denyReport(moderator: string, reason: string): Promise<void> {
        this.denied = true
        this.moderatorId = moderator
        this.reason = reason
        await this.save()
        const message = await this.fetchMessage(client)
        if (message) {
            await message.edit(this.createEditEmbed())
        }
        await this.denySubmitter(client)
        await this.softRemove()
    }

    public static async buttonPress(
        client: Client,
        button: Discord.ButtonInteraction
    ): Promise<void> {
        const id = button.customId.split(".")[1]
        const sususer = await SuspiciousUser.findOne({ where: { id: id } })
        const user = button.user
        const guildMember = await client.customGuilds
            .main()
            .members.fetch(user.id)
            .catch(noop)
        if (
            !guildMember ||
            !GuildMember.hasRole(
                guildMember,
                [client.roles.MODERATOR, client.roles.HELPER, client.roles.MANAGER],
                client
            )
        ) {
            await client.response.sendError(
                button,
                "You do not have permission to do that."
            )
        }
        if (sususer) {
            if (button.customId.split(".")[2] === "approved") {
                const modalId = await CommandMessage.showModal(
                    client,
                    button,
                    "suspicious_user",
                    { reason: "The user was punished." }
                )
                client.interactionInfo.set(modalId, {
                    modalType: "suspicioususermodal",
                    suspiciousUser: sususer,
                    type: "approved"
                })
            } else if (button.customId.split(".")[2] === "denied") {
                const modalId = await CommandMessage.showModal(
                    client,
                    button,
                    "suspicious_user",
                    { reason: "Denial Reason" }
                )
                client.interactionInfo.set(modalId, {
                    modalType: "suspicioususermodal",
                    suspiciousUser: sususer,
                    type: "denied"
                })
            }
        }
    }
}
