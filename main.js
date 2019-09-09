//shared todo list
const express = require('express');
const socketIO = require('socket.io');
const entities = new (require('html-entities').AllHtmlEntities)();
const bodyParser = require('body-parser');
const sharedSession = require('express-socket.io-session');
const session = require('express-session');
const fs = require('fs');

const app = express();
const server = app.listen(8080);
const io = socketIO.listen(server);

var gl_newUserId = 0;
var gl_newTodoId = 0;

/*
** to access to req.session throught socket
*/
const sessionMiddleware = session({
	secret: 'bretelle d\'emmerdes',
	resave: true,
	saveUninitialized: true,
	cookie: {
		path: '/',
		httpOnly: 'true',
		saveUninitialized: true,
		sameSite: true,
		secure: false,			//because I use http #noob
		maxAge: 15552000000		//6 months
	}
});

/**********/
/** USES **/
/**********/
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(sessionMiddleware);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

io.use(sharedSession(sessionMiddleware, {
	autoSave: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


/**************************/
/**** ROUTE management ****/
/**************************/

/*****/
/* / */
/*****/
app.get('/', (req, res) => {
	res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');

	if (checkSession(req) === true) {
		res.render('index.html.ejs', { ejs_userName: req.session.userName, todoList : getSessionTodoList(req) });
	} else {
		res.render('login.html.ejs');
	}
})
/***********/
/* /jq.js  */
/***********/
.get('/jq.js', (req, res) => {
	res.status(200).setHeader('Content-Type', 'application/javascript');
	res.render('./js/jq.js.ejs');
})
/***********/
/* /login  */
/***********/
.post('/login', (req, res) => {
	if ((!checkSession(req))
		&& (checkPseudo(req.body.pseudo) === true)) {
			req.session.userName = req.body.pseudo.trim();
			req.session.userId = gl_newUserId;
			req.session.todoList = [];
			gl_newUserId++;
	}

	res.status(200).redirect('/');
})
/*******************/
/* /disconnect.js  */
/*******************/
.get('/disconnect', (req, res) => {
	res.status(200).setHeader('Content-Type', 'text/html');
	req.session.destroy();
	res.redirect('/');
})
/******************/
/* /imgs/list.png */
/******************/
.get('/imgs/list.png', (req, res) => {
	res.status(200).setHeader('Content-Type', 'image/png');
	res.send(fs.readFileSync('./views/imgs/list.png'));
})
/**************/
/* ELSE route */
/**************/
.use((req, res) => {
	res.status(301).redirect('/');
});

/***************************/
/**** SOCKET MANAGEMENT ****/
/***************************/

io.sockets.on('connection', function (socket) {
	/*
	** Get session todoList
	*/
	socket.on('csSendMeTodoList', function (datas) {
		socket.emit('ssHereIsTodoList', { todoList: getSessionTodoList(socket.handshake) });
	});

	/*
	** Add Todo
	*/
	socket.on('csIWantToAddThisTodo', function (data) {
		if (data !== null && checkInputTodo(data.todoInput)) {

			let newTodo = {
				id: gl_newTodoId++,
				todoString: secureString(data.todoInput.trim().substring(0,80)),
				createdBy: secureString(socket.handshake.session.userName),
				creationDate: Date.now(),
				lastUpdater: null,
				lastUpdated: null
			}

			getSessionTodoList(socket.handshake).unshift(newTodo);
			socket.emit('ssNewAddedTodo', { newTodo: newTodo });
		}
	});

	/*
	** Del Todo
	*/
	socket.on('csIWantToDelThisTodo', function (data) {
		if (data !== null && checkId(parseInt(data.todoId))) {
			socket.handshake.session.todoList = getSessionTodoList(socket.handshake).filter(function (value, index, arr) {
				return (value.id !== parseInt(data.todoId));
			});

			socket.emit('ssThisTodoHasBeenDeleted', { delTodoId: data.todoId });
		}
	});

	/*
	** Mod Todo
	*/
	socket.on('csIWantToModThisTodo', function (data) {
		if (data !== null
			&& checkId(parseInt(data.todoId))
			&& checkInputTodo(data.todoString)) {

			let idToMod = parseInt(data.todoId);
			let modTodo = getSessionTodoList(socket.handshake).find(function (value, index, arr) {
				return (value.id === idToMod)
			}); 

			if (((typeof (modTodo)) !== 'undefined')
				&& (data.todoString.trim() !== modTodo.todoString)) {
				modTodo.todoString = secureString(data.todoString);
				modTodo.lastUpdated = Date.now();
				modTodo.lastUpdater = socket.handshake.session.userName;
			}

			socket.emit('ssThisTodoHasBeenModified', {
					modTodoId: modTodo.id,
					modTodoString: modTodo.todoString,
					modTodoLastUpdated: modTodo.lastUpdated,
					modTodoLastUpdater: modTodo.lastUpdater
			});
		}
	});
});

/*******************/
/**** FUNCTIONS ****/
/*******************/
function checkSession(req) {
	if ((typeof (req.session.userName) === 'undefined')
	|| (typeof (req.session.userName) !== typeof ('pouet'))) {
		return false;
	}

	
	return true;
}

function getSessionTodoList(req) {
	if ((typeof (req.session.todoList) === 'undefined')
	|| (!(req.session.todoList instanceof Array))) {
		req.session.todoList = [];
	}

	return req.session.todoList;
}

/*
** checkPseudo(): check if the string passed in arg is a valid pseudo String
*/
function checkPseudo(inputPseudo) {
	if ((typeof (inputPseudo) === typeof ('pouet'))
		&& (inputPseudo.trim() !== '')
		&& (inputPseudo.length <= 20)) {
		return true;
	}

	return false;
}

function checkId(pId) {
	if ((Number.isInteger(pId))
		&& (pId >= 0)) {
		return true;
	}

	return false;
}

function checkInputTodo(pInput) {
	if ((typeof (pInput) === typeof ('pouet'))
		&& (pInput.trim() !== '')) {
		return (true);
	}

	return (false);
}

/*
** secureString(): secure the string to avoid xss, buffer overflows and other kind of things
*/
function secureString(str) {
	return (entities.encode(str).trim());
}

/*
** secureId(): to be sure that the id is coherent
*/
function secureId(pId) {
	if (typeof (pId) === typeof (42)
		&& (pId >= 0)) {
		return pId;
	}

	return -1;
}