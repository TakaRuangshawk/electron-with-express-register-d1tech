import express from "express";
import path from "path";
import logger from "morgan";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import http from "http";
import createError from "http-errors";
import { expressPort } from "../package.json";
import cors from "cors";
import { Server as IOServer } from "socket.io";
const fs = require('fs');
const app = express();
const router = express.Router();
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const routes = [
  { path: "/", viewName: "index", title: "Home", },
  { path: "/pageTwo", viewName: "pageTwo", title: "Page 2" },
  { path: "/pageThree", viewName: "pageThree", title: "Page 3" },
  { path: "/pageFour", viewName: "pageFour", title: "Page 4" }
];

routes.forEach(({ path, viewName, title }) => {
  router.get(path, (req, res) => {
    const lang = req.query.lang || 'th';
    const page = "register";
    res.render(viewName, { title, lang, page });
  });
});


app.set("port", expressPort);
app.set("views", path.join(__dirname, "..", "views"));
app.set("view engine", "ejs");

const corsOptions = {
  origin: 'http://127.0.0.1:3000',
  methods: ['GET', 'POST']
};

app.use(cors(corsOptions));
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));
const peopleJsonPath = path.join(__dirname, '../public/people_list.json');

app.use("/", router);
app.use((err: any, req: any, res: any, _next: any) => {
  res.locals.title = "erro=r";
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500).render("error");
});
app.post('/card-event', (req, res) => {
  const { status, data } = req.body;

  if (status === 'inserted') {
    io.emit('card-inserted');
  } else if (status === 'removed') {
    io.emit('card-removed');
  } else if (status === 'card-data') {
    io.emit('card-data', data); 
  }

  res.status(200).send('OK');
});

interface Person {
  first_name: string;
  last_name: string;
  bank: string;
}

const peopleList: Person[] = JSON.parse(fs.readFileSync(peopleJsonPath, 'utf-8'));

function findPerson(firstName: string, lastName: string): Person | undefined {
  return peopleList.find(
    person =>
      person.first_name === firstName.trim() &&
      person.last_name === lastName.trim()
  );
}

app.post('/check-name', express.json(), (req, res) => {
  const { f_name, l_name } = req.body;
  const person = findPerson(f_name, l_name);
  if (person) {
    res.json({ found: true, bank: person.bank });
  } else {
    res.json({ found: false });
  }
});


app.use((_req, _res, next) => next(createError(404)));


function handleServerError(error: any) {
  if (error.syscall !== "listen") throw error;

  const bind = typeof expressPort === "string" ? `Pipe ${expressPort}` : `Port ${expressPort}`;
  switch (error.code) {
    case "EACCES":
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function shutdown() {
  console.log("Shutting down Express server...");
  server.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(expressPort);
server.on("error", handleServerError);
server.on("listening", () => console.log(`Listening on: ${expressPort}`));
server.on("close", () => console.log("Express server closed."));
