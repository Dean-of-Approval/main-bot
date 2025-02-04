import typeorm from "typeorm"
import Discord from "discord.js"
import Client from "../struct/Client.js"
import languages from "../struct/client/iso6391.js"
import { hexToNum } from "@buildtheearth/bot-utils"
import unicode from "./transformers/unicode.transformer.js"

@typeorm.Entity({ name: "snippets" })
export default class Snippet extends typeorm.BaseEntity {
    @typeorm.PrimaryGeneratedColumn()
    id!: number

    @typeorm.Column({ length: 32 })
    name!: string

    @typeorm.Column({ length: 4 })
    language!: string

    @typeorm.Column({ length: 2000, transformer: unicode })
    body!: string

    @typeorm.Column()
    type!: "snippet" | "rule" | "team"

    @typeorm.Column("simple-array")
    aliases!: string[]

    displayEmbed(client: Client): Discord.APIEmbed {
        const language = languages.getName(this.language)
        return {
            color: hexToNum(client.config.colors.success),
            author: { name: `'${this.name}' snippet in ${language}` },
            description: this.body
        }
    }
}
