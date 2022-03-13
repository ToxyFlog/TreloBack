const {authenticated, hasAccess, isOwner} = require("../services/authentication");
const validateBody = require("./schemas/validateBody");
const validate = require("./schemas/board");
const boardDB = require("../db/board");
const express = require("express");
const {wsUsernameToSocketId} = require("./tempStorage");

const router = express.Router();

router.use(authenticated);


router.get("/:boardId", hasAccess, (req, res) => res.send(res.locals.board));

router.post("/", validateBody(validate.createBoard), async (req, res) => {
	const {title, boardId} = req.body;

	if (!(await boardDB.addBoard(title, boardId, res.locals.user.username))) return res.sendStatus(400);
	res.sendStatus(200);
});

router.post("/user", isOwner, validateBody(validate.addUser), async (req, res) => {
	const {username, boardId} = req.body;

	const [error, user] = await boardDB.addUser(res.locals.board, username);

	res.send([error, user]);
	if (error) return;


	const wss = res.locals.wss;
	const socketId = res.locals.socketId;

	wss.to([boardId]).except(socketId).emit("board:addUser", {boardId, user});

	const targetSocketId = wsUsernameToSocketId[username];
	if (!targetSocketId) return;

	const {id, title} = await boardDB.getBoard(boardId);
	wss.to([targetSocketId]).emit("board:add", {id, title});
});

router.post("/list", isOwner, validateBody(validate.addList), async (req, res) => {
	const {boardId, list} = req.body;

	if (!(await boardDB.addList(boardId, list))) return res.sendStatus(400);
	res.sendStatus(200);


	const wss = res.locals.wss;
	const socketId = res.locals.socketId;

	wss.to([boardId]).except(socketId).emit("board:addList", {boardId, list});
});

router.put("/list", isOwner, validateBody(validate.changeList), async (req, res) => {
	const {list, boardId} = req.body;

	if (!(await boardDB.changeList(list))) return res.sendStatus(400);
	res.sendStatus(200);


	const wss = res.locals.wss;
	const socketId = res.locals.socketId;

	wss.to([boardId]).except(socketId).emit("board:changeList", {boardId, list});
});

router.put("/user", isOwner, validateBody(validate.changeUser), async (req, res) => {
	const {username, isOwner, boardId} = req.body;

	if (!(await boardDB.changeUser(boardId, username, isOwner))) return res.sendStatus(400);
	res.sendStatus(200);


	const wss = res.locals.wss;
	const socketId = res.locals.socketId;
	const targetSocketId = wsUsernameToSocketId[username];

	wss.to([boardId, targetSocketId]).except(socketId).emit("board:changeUser", {boardId, username, isOwner});
});

router.put("/", isOwner, validateBody(validate.changeBoard), async (req, res) => {
	const {title, boardId} = req.body;

	if (!(await boardDB.changeBoard(boardId, title))) return res.sendStatus(400);
	res.sendStatus(200);


	const wss = res.locals.wss;
	const socketId = res.locals.socketId;

	wss.to([boardId]).except(socketId).emit("board:change", {boardId, title});
});

router.delete("/:boardId", isOwner, async (req, res) => {
	const {boardId} = req.params;

	if (!(await boardDB.deleteBoard(boardId))) return res.sendStatus(400);
	res.sendStatus(200);


	const wss = res.locals.wss;
	const socketId = res.locals.socketId;

	wss.to([boardId]).except(socketId).emit("board:delete", boardId);
});

router.delete("/list/:boardId/:id", isOwner, async (req, res) => {
	const {boardId, id} = req.params;

	if (!(await boardDB.deleteList(boardId, id))) return res.sendStatus(400);
	res.sendStatus(200);


	const wss = res.locals.wss;
	const socketId = res.locals.socketId;

	wss.to([boardId]).except(socketId).emit("board:deleteList", {boardId, id});
});

router.delete("/user/:boardId/:username", isOwner, async (req, res) => {
	const {username, boardId} = req.params;

	if (!(await boardDB.deleteUser(boardId, username))) return res.sendStatus(400);
	res.sendStatus(200);


	const wss = res.locals.wss;
	const socketId = res.locals.socketId;

	wss.to([boardId]).except(socketId).emit("board:deleteUser", {boardId, username});

	const targetSocketId = wsUsernameToSocketId[username];
	if (!targetSocketId) return;

	wss.to([targetSocketId]).emit("board:delete", boardId);
});


module.exports = router;