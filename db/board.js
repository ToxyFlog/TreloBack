const client = require("./index");

const getBoard = async id => {
	const res = await client.query(`
	with l as (
        select array_agg(to_json(l)::jsonb - 'boardid') as lists
        from board_lists as l
        where l.boardid = $1::uuid
    ),
    u as (
        select array_agg(to_json(u)::jsonb - 'boardid') as users
        from board_users as u
        where u.boardid = $1::uuid
    )
	select * from boards, u, l where boards.id = $1::uuid;`,
		[id],
	).catch(e => e);
	if (!res || res.rows.length !== 1) return null;

	const r = res.rows[0];
	r.lists = r.lists || [];
	return {...r, lists: r.lists.filter(a => a), users: r.users.map(cur => ({icon: cur.icon, isOwner: cur.isowner, username: cur.username}))};
};

const addBoard = async (title, id, username) => {
	try {
		await client.query("begin;");
		await client.query(`insert into boards(title, id) values ($1, $2);`, [title, id]);
		await client.query(`insert into board_lists(boardid, title, id) values ($1, 'Backlog', uuid_generate_v4())`, [id]);
		await client.query(`insert into board_lists(boardid, title, id) values ($1, 'Progress', uuid_generate_v4())`, [id]);
		await client.query(`insert into board_lists(boardid, title, id) values ($1, 'Done', uuid_generate_v4())`, [id]);
		await client.query(`
			insert into board_users(boardId, username, isOwner, icon) 
			values ($1::uuid, $2::varchar, true, (select icon from users where users.username = $2::varchar))`,
			[id, username],
		);
		await client.query(`
			insert into user_boards(username, title, isfavourite, isowner, boardid)
			values ($1, $2, false, true, $3)`,
			[username, title, id],
		);
		await client.query("commit;");
		return true;
	} catch (e) {
		console.log(e);
		await client.query("rollback;");
		return false;
	}
};

const changeTitle = async (boardId, title) => {
	try {
		await client.query("begin;");
		await client.query(`
			update boards set title = $1 where boards.id = $2::uuid;`,
			[title, boardId],
		);
		await client.query(`
			update user_boards
			set title = $1
  			where user_boards.boardid = $2::uuid;`,
			[title, boardId],
		);
		await client.query("commit;");

		return true;
	} catch (e) {
		await client.query("rollback;");
		return false;
	}
};

const deleteBoard = async id => {
	try {
		await client.query("begin;");
		await client.query("delete from card_files where card_files.cardid in (select cardid from cards where boardid = $1::uuid);", [id]);
		await client.query("delete from cards where cards.boardid = $1::uuid;", [id]);
		await client.query("delete from boards where boards.id = $1::uuid;", [id]);
		await client.query("delete from board_users where board_users.boardid = $1::uuid;", [id]);
		await client.query("delete from board_lists where board_lists.boardid = $1::uuid;", [id]);
		await client.query("delete from user_boards where user_boards.boardid = $1::uuid;", [id]);
		await client.query("commit;");

		return true;
	} catch (e) {
		await client.query("rollback;");
		return false;
	}
};

const addUser = async (board, username) => {
	try {
		await client.query("begin;");
		const user = await client.query("select * from users where username = $1", [username]);
		if (!user || user.rows.length !== 1) {
			await client.query("commit;");
			return ["User doesn't exist"];
		}

		await client.query(`
			insert into board_users(boardId, username, isOwner, icon) 
			values ($1::uuid, $2::varchar, false, (select icon from users where users.username = $2::varchar))`,
			[board.id, username],
		);
		await client.query(`
			insert into user_boards(username, title, isfavourite, isowner, boardid)
			values ($1, $2, false, false, $3)`,
			[username, board.title, board.id],
		);
		await client.query("commit;");

		return [null, {...user.rows[0], password: undefined}];
	} catch (e) {
		await client.query("rollback;");
		return ["Error"];
	}
};

const deleteUser = async (boardId, username) => {
	try {
		await client.query("begin;");
		await client.query(
			"delete from board_users where boardid = $1 and username = $2;",
			[boardId, username],
		);
		await client.query(
			"delete from user_boards where boardid = $1 and username = $2;",
			[boardId, username],
		);
		await client.query("commit;");

		return true;
	} catch (e) {
		await client.query("rollback;");
		return false;
	}
};

const changeRole = async (boardId, username, isOwner) => {
	try {
		await client.query("begin;");
		await client.query(`
			update board_users set isowner = $1::bool
			where board_users.boardid = $2::uuid 
			and board_users.username = $3;`,
			[isOwner, boardId, username],
		);
		await client.query(`
			update user_boards set isowner = $1::bool
			where user_boards.username = $2 and user_boards.boardid = $3::uuid;`,
			[isOwner, username, boardId],
		);
		await client.query("commit;");

		return true;
	} catch (e) {
		await client.query("rollback;");
		return false;
	}
};

const addList = async (boardId, id, title) => {
	const res = await client.query(
		"insert into board_lists(boardId, title, id) values ($1, $2, $3);",
		[boardId, title, id],
	).catch(e => null);

	return res ? res.rows : null;
};

const changeList = async (id, title) => {
	const res = await client.query(
		`update board_lists set title = $1 where board_lists.id = $2::uuid;`,
		[title, id],
	).catch(e => null);

	return res ? res.rows : null;
};

const deleteList = async id => {
	try {
		await client.query("begin;");
		await client.query("delete from board_lists where id = $1::uuid;", [id]);
		await client.query("delete from card_files where cardid in (select id from cards where listid = $1::uuid)", [id]);
		await client.query("delete from cards where listid = $1::uuid", [id]);
		await client.query("commit;");

		return true;
	} catch (e) {
		await client.query("rollback;");
		return false;
	}
};

module.exports = {getBoard, addBoard, addUser, changeTitle, deleteBoard, deleteUser, changeRole, addList, changeList, deleteList};