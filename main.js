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

var gl_todoList = [];
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
		res.render('index.html.ejs', { ejs_userName: req.session.userName, todoList : req.session.todoList });
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
/*****************/
/* /getTodoList  */
/*****************/
.post('/getTodoList', (req, res) => {
	/*
	checkSessionTodo(req);
	res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
	//res.send(JSON.stringify({ todoList : req.session.todoList }));
	res.send(JSON.stringify({ todoList : gl_todoList }));
	*/
	checkSession(req);
	res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
	res.send(JSON.stringify({ todoList : gl_todoList }));
	
})
/*************/
/* /addTodo  */
/*************/
.post('/addTodo', (req, res) => {
	/*
	checkSessionTodo(req);
	if (checkInputTodo(req.body.todo_input)){
		//req.session.todoList.push(entities.encode(req.body.todo_input.trim().substring(0,80)));
		gl_todoList.push(secureString(req.body.todo_input.trim().substring(0,80)));
	}

	res.status(200).redirect('/');
	*/

	if (checkInputTodo(req.body.todo_input)) {

		gl_todoList.unshift({
			id: gl_newTodoId,
			todoString: secureString(req.body.todo_input.trim().substring(0,80)),
			createdBy: secureString(req.session.userName),
			creationDate: Date.now(),
			lastUpdater: null,
			lastUpdated: null,
		});

		gl_newTodoId++;
	}

	res.status(200).redirect('/');
})
/************/
/* /delTodo */
/************/
.post('/delTodo/', (req, res) => {
	
	//checkSessionTodo(req);
	res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');

	let idToDel = parseInt(req.body.id);

	/*
	if (checkId(id, req.session.todoList)) {
		req.session.todoList.splice(id, 1);
	}
	*/

	if (checkId(idToDel)) {
		gl_todoList = gl_todoList.filter(function (value, index, arr) {
			return (value.id !== idToDel);
		});
	}

	res.redirect('/');
})
/************/
/* /modTodo */
/************/
.post('/modTodo/', (req, res) => {
	/*
	checkSessionTodo(req);

	let id = parseInt(req.body.todoId);
	if (checkId(id, req.session.todoList)
		&& (checkInputTodo(req.body.todoValue))) {
			req.session.todoList[id] = entities.encode(req.body.todoValue.trim().substring(0, 80));
	}

	res.redirect('/');
	*/

	let idToMod = parseInt(req.body.todoId);
	if (checkId(idToMod)
		&& (checkInputTodo(req.body.todoValue))) {
			let currentTodo = gl_todoList.find(function (value, index, arr) {
				return (value.id === idToMod)
			}); 

			currentTodo.todoString = secureString(req.body.todoValue);
			currentTodo.lastUpdated = Date.now();
			currentTodo.lastUpdater = req.session.userName;
	}

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
})


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

function checkSessionTodo(req) {
	if ((typeof (req.session.todoList) === 'undefined')
	|| (!(req.session.todoList instanceof Array))) {
		req.session.todoList = [];
	}
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