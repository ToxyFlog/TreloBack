const ajv = new (require("ajv"))();
require("ajv-formats")(ajv, ["uuid"]);

module.exports = ajv.compile({
	$async: true,
	properties: {
		boardId: {
			type: "string",
			format: "uuid",
		},
		socketId: {
			type: "string",
			minLength: 1,
		},
		title: {
			type: "string",
			minLength: 1,
			maxLength: 30,
		},
	},
	required: ["boardId", "socketId", "title"],
	additionalProperties: false,
	type: "object",
});