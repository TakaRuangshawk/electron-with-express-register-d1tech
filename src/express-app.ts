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
import * as XLSX from 'xlsx';
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
const peopleJsonPath = path.join('D:/d1config/people_list.json');
const excelPath = path.join('D:/d1config/รายชื่อลูกค้า.xlsx');
function syncPeopleFromExcel() {
  if (!fs.existsSync(excelPath)) return;

  const people: Person[] = fs.existsSync(peopleJsonPath)
    ? JSON.parse(fs.readFileSync(peopleJsonPath, "utf-8"))
    : [];

  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    const first = row[2]?.toString().trim();
    const last = row[3]?.toString().trim();
    const bank = row[5]?.toString().trim();

    if (!first || !last || !bank) continue;

    const exists = people.some(p => p.first_name === first && p.last_name === last && p.bank === bank);
    if (!exists) {
      people.push({ first_name: first, last_name: last, bank });
    }
  }
  fs.writeFileSync(peopleJsonPath, JSON.stringify(people, null, 2), 'utf-8');
}

syncPeopleFromExcel();
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
  register_count?: number;
}

const peopleList: Person[] = JSON.parse(fs.readFileSync(peopleJsonPath, 'utf-8'));

let maxRegisterCount = 0;
for (const person of peopleList) {
  if (typeof person.register_count === "number" && person.register_count > maxRegisterCount) {
    maxRegisterCount = person.register_count;
  }
}
let globalRegisterCounter = maxRegisterCount;

function getNextRegisterCount() {
  globalRegisterCounter += 1;
  return globalRegisterCounter;
}

function findPerson(firstName: string, lastName: string) {
  const person = peopleList.find(
    p => p.first_name === firstName.trim() && p.last_name === lastName.trim()
  );
  if (!person) return null;

  if (!('register_count' in person)) {
    person.register_count = getNextRegisterCount();
    fs.writeFileSync(peopleJsonPath, JSON.stringify(peopleList, null, 2), 'utf-8');
  }

  return person;
}


app.post('/check-name', express.json(), (req, res) => {
  const { f_name, l_name } = req.body;
  const person = findPerson(f_name, l_name);

  if (person) {
    res.json({
      found: true,
      bank: person.bank,
      register_count: person.register_count 
    });
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
