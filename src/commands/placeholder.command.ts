import Client from "../struct/Client.js"
import Args from "../struct/Args.js"
import Command from "../struct/Command.js"
import CommandMessage from "../struct/CommandMessage.js"

import iso6391 from "../struct/client/iso6391.js"
import { hexToNum } from "@buildtheearth/bot-utils"

export default new Command({
    name: "placeholder",
    aliases: ["placeholders"],
    description: "List and manage placeholders.",
    permission: [
        globalThis.client.roles.MODERATOR,
        globalThis.client.roles.HELPER,
        globalThis.client.roles.MANAGER,
        globalThis.client.roles.PR_TRANSLATION_TEAM
    ],
    subcommands: [
        {
            name: "list",
            description: "List all placeholders."
        },
        {
            name: "add",
            description: "Add a placeholder.",
            args: [
                {
                    name: "name",
                    description: "placeholder name.",
                    required: true,
                    optionType: "STRING"
                },
                {
                    name: "language",
                    description: "placeholder language.",
                    required: true,
                    optionType: "STRING"
                },
                {
                    name: "body",
                    description: "placeholder body.",
                    required: false,
                    optionType: "STRING"
                }
            ]
        },
        {
            name: "edit",
            description: "Edit a placeholder.",
            args: [
                {
                    name: "name",
                    description: "placeholder name.",
                    required: true,
                    optionType: "STRING"
                },
                {
                    name: "language",
                    description: "placeholder language.",
                    required: true,
                    optionType: "STRING"
                },
                {
                    name: "body",
                    description: "placeholder body.",
                    required: false,
                    optionType: "STRING"
                }
            ]
        },
        {
            name: "delete",
            description: "Delete a placeholder.",
            args: [
                {
                    name: "name",
                    description: "placeholder name.",
                    required: true,
                    optionType: "STRING"
                },
                {
                    name: "language",
                    description: "placeholder language.",
                    required: true,
                    optionType: "STRING"
                }
            ]
        },
        {
            name: "info",
            description: "Get info about a placeholder.",
            args: [
                {
                    name: "name",
                    description: "placeholder name.",
                    required: true,
                    optionType: "STRING"
                },
                {
                    name: "language",
                    description: "placeholder language.",
                    required: true,
                    optionType: "STRING"
                }
            ]
        }
    ],
    async run(this: Command, client: Client, message: CommandMessage, args: Args) {
        const subcommand = args.consumeSubcommandIf([
            "list",
            "add",
            "edit",
            "delete",
            "info"
        ])
        const name = args.consume("name").toLowerCase()
        if (name.length > 32) return message.sendErrorMessage("nameTooLong32")
        const language = args.consume("language").toLowerCase()
        const body = args.consumeRest(["body"])

        if (!(subcommand === "add" || subcommand === "edit")) await message.continue()
        const placeholders = client.placeholder.cache
        if (subcommand === "list" || !subcommand) {
            const tidy: Record<string, { languages: string[] }> = {}

            for (const placeholder of placeholders.values()) {
                if (!tidy[placeholder.name])
                    tidy[placeholder.name] = {
                        languages: []
                    }
                tidy[placeholder.name].languages.push(placeholder.language)
            }

            const sortedPlaceholders = Object.entries(tidy)

            sortedPlaceholders.sort((a, b) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const [sort1, sort2]: any = [a[0], b[0]]
                if (sort1 < sort2) return -1
                if (sort1 > sort2) return 1
                return 0
            })

            const embed = {
                author: { name: "Placeholder list" },
                description: ""
            }
            for (const [name, { languages }] of sortedPlaceholders) {
                languages.sort()
                const onlyEnglish = languages.length === 1 && languages[0] === "en"
                const languageList = onlyEnglish ? "" : ` (${languages.join(", ")})`
                embed.description += `• \u200B \u200B ${name}${languageList}\n`
                    .split("_")
                    .join("\\_")
            }
            await message.sendSuccess(embed)
        } else if (subcommand === "add") {
            if (placeholders.has(name + " " + language))
                return message.sendErrorMessage("alreadyExistsPlaceholder")
            if (!name) return message.sendErrorMessage("noPlaceholderName")
            if (!language) return message.sendErrorMessage("noLang")
            if (!iso6391.validate(language))
                return message.sendErrorMessage("invalidPlaceholderLang")
            if (name.match(/{+|}+/g))
                return message.sendErrorMessage("invalidPlaceholderName")
            if (!body) {
                const modalId = await message.showModal("placeholder")
                return client.interactionInfo.set(modalId, {
                    name: name,
                    language: language,
                    subcommand: "add",
                    modalType: "placeholdermodal"
                })
            }
            await client.placeholder.addPlaceholder(name, language, body)
            await message.sendSuccessMessage("addedPlaceholder", name, language)
            const placeholderTemp = placeholders.get(name + " " + language)
            if (placeholderTemp) client.log(placeholderTemp, "add", message.member.user)
        } else if (subcommand === "edit") {
            if (!name) return message.sendErrorMessage("noPlaceholderName")
            if (!language) return message.sendErrorMessage("noLang")
            if (!placeholders.has(name + " " + language))
                return message.sendErrorMessage("placeholderNotFound")
            if (!body) {
                const placeholderTemp = placeholders.get(name + " " + language)
                if (placeholderTemp) {
                    // this should never not happen unless theres some fatal error
                    const modalId = await message.showModal("placeholder", {
                        body: placeholderTemp.body
                    })
                    return client.interactionInfo.set(modalId, {
                        name: name,
                        language: language,
                        subcommand: "edit",
                        modalType: "placeholdermodal",
                        existingPlaceholder: placeholderTemp
                    })
                }
            }
            await client.placeholder.editPlaceholder(name, language, body)
            await message.sendSuccessMessage("editedPlaceholder", name, language)
            const placeholderTemp = placeholders.get(name + " " + language)
            if (placeholderTemp) client.log(placeholderTemp, "edit", message.member.user)
        } else if (subcommand === "delete") {
            if (!name) return message.sendErrorMessage("noPlaceholderName")
            if (!language) return message.sendErrorMessage("noLang")
            const placeholderTemp = placeholders.get(name + " " + language)
            if (!placeholderTemp) return message.sendErrorMessage("placeholderNotFound")
            client.placeholder.deletePlaceholder(name, language)
            await message.sendSuccessMessage("deletedPlaceholder", name, language)
            client.log(placeholderTemp, "delete", message.member.user)
        } else if (subcommand === "info") {
            if (!name) return message.sendErrorMessage("noPlaceholderName")
            if (!language) return message.sendErrorMessage("noLang")
            const placeholderTemp = placeholders.get(name + " " + language)
            if (!placeholderTemp) return message.sendErrorMessage("placeholderNotFound")
            const placeholder = placeholderTemp
            const embed = {
                color: hexToNum(client.config.colors.info),
                description:
                    `The **${placeholder.name}** placeholder responds with ` +
                    `the following text in ${iso6391.getName(placeholder.language)}:` +
                    `\n\`\`\`\n${placeholder.body}\`\`\``
            }
            await message.send({ embeds: [embed] })
        }
    }
})
