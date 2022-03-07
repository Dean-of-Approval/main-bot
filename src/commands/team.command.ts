import Client from "../struct/Client.js"
import Args from "../struct/Args.js"
import Command from "../struct/Command.js"
import Roles from "../util/roles.util.js"
import typeorm from "typeorm"
import Snippet from "../entities/Snippet.entity.js"
import CommandMessage from "../struct/CommandMessage.js"

export default new Command({
    name: "team",
    aliases: ["buildteam", "bt", "invite"],
    description: "Get an invite for a build team.",
    permission: Roles.ANY,
    args: [
        {
            name: "team",
            description: "Team to get",
            required: true,
            optionType: "STRING"
        }
    ],
    async run(this: Command, client: Client, message: CommandMessage, args: Args) {
        const input = args.consumeRest(["team"]).toLowerCase()
        if (!input) return client.response.sendError(message, client.messages.noTeam)

        await message.continue()

        const Snippets = Snippet.getRepository()
        const language = "en"
        const find = (query: typeorm.WhereExpression) =>
            query
                .where("snippet.name = :name", { name: input })
                .andWhere("snippet.type = 'team'")
                .orWhere(
                    new typeorm.Brackets(qb => {
                        qb.where("FIND_IN_SET(:name, snippet.aliases)").andWhere(
                            "snippet.type = 'team'"
                        )
                    })
                )
        const snippet = await Snippets.createQueryBuilder("snippet")
            .where("snippet.language = :language", { language })
            .andWhere(new typeorm.Brackets(find))
            .getOne()

        if (!snippet) {
            return client.response.sendError(message, client.messages.invalidTeam)
        } else {
            return message
                .send({ content: snippet.body, allowedMentions: { parse: [] } })
                .catch(() => null)
        }
    }
})
