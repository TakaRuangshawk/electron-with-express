import express from "express";
import cors from "cors";
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from "path";
import logger from "morgan";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import http from "http";
import createError from "http-errors";
import { expressPort, logDrive } from "../package.json";
import fs from "fs";
import { Request, Response } from 'express';

const app = express();
const router = express.Router();

const logDirectory = logDrive + "://logs";

function writeLogToFile(logMessage: string) {
  const currentDate = new Date();
  const dateString = currentDate.toISOString().slice(0, 10).replace(/-/g, "");
  const logFilePath = path.join(logDirectory, `MTLog_${dateString}.log`);

  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }

  fs.appendFile(logFilePath, `${logMessage}\n`, (err) => {
    if (err) {
      console.error("Error writing to log file:", err);
    }
  });
}

const filePath = path.join(__dirname, 'users.json');
const defaultUsers = [
  { username: 'administrator', password: '111111' },
  { username: 'bankoperation', password: '111111' },
];

if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify(defaultUsers, null, 2));
}

// Function to read users from the JSON file
const readUsers = (): { username: string, password: string }[] => {
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }
  return defaultUsers;
};

// Function to write users to the JSON file
const writeUsers = (users: { username: string, password: string }[]): void => {
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
};

const loginHandler = (req: Request, res: Response) => {
  console.log('POST /login', req.body);
  const { username, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if(user?.username === undefined){
    res.status(401).json({ error: 'Please select account user ' });
  }
  else{
    if (user) {
      res.json({ success: true, redirect: `/index?username=${username}` });
    } else {
      res.status(401).json({ error: 'Please enter correct password ' });
    }
  }
};

const changePasswordHandler = (req: Request, res: Response) => {
  console.log('POST /change-password', req.body);
  const { username, oldPassword, newPassword } = req.body;
  let users = readUsers();
  const userIndex = users.findIndex(u => u.username === username && u.password === oldPassword);

  if (userIndex !== -1) {
    users[userIndex].password = newPassword;
    writeUsers(users);
    res.json({ message: 'Password changed successfully' });
  } else {
    res.status(400).json({ error: 'Please enter correct password' });
  }
};

function formatDate(date: Date): string {
  const pad = (num: number, size: number): string => {
    let s = "000" + num;
    return s.substr(s.length - size);
  };

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1, 2); // Months are zero-based
  const day = pad(date.getDate(), 2);
  const hours = pad(date.getHours(), 2);
  const minutes = pad(date.getMinutes(), 2);
  const seconds = pad(date.getSeconds(), 2);
  const milliseconds = pad(date.getMilliseconds(), 3);

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}:${milliseconds}`;
}

function sendMessageHandler(req: Request, res: Response) {
  const message = req.body.message;
  const logMessage = `[${formatDate(new Date())}] ${message}`;
  console.log(logMessage);
  writeLogToFile(logMessage);
  res.json({ success: true, message: "Message received and logged" });
}

const routes = [
  { path: "/", viewName: "login", title: "Login" },
  { path: "/index", viewName: "index", title: "Home" },
  { path: "/pageTwo", viewName: "pageTwo", title: "Page 2" },
  { path: "/pageThree", viewName: "pageThree", title: "Page 3" },
  { path: "/pageFour", viewName: "pageFour", title: "Page 4" },
  { path: "/sendMessage", method: "post", handler: sendMessageHandler },
  { path: "/login", method: "post", handler: loginHandler },
  { path: "/change-password", method: "post", handler: changePasswordHandler }
];

routes.forEach(({ path, viewName, title, method, handler }) => {
  if (method === "post") {
    router.post(path, handler);
  } else {
    router.get(path, (req, res) => {
      if (viewName && title) {
        const { username } = req.query;
        if (viewName === "index") {
          res.render(viewName, { title, username });
          console.log('username : '+ username);
        } else {
          res.render(viewName, { title });
          console.log('no user required');
        }
      } else {
        res.status(500).send("Internal Server Error");
      }
    });
  }
});

app.set("port", expressPort);
app.set("views", path.join(__dirname, "..", "views"));
app.set("view engine", "ejs");

app.use(cors()); // Enable CORS
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/", router);
app.use((_req, _res, next) => next(createError(404)));
app.use((err: any, req: any, res: any, _next: any) => {
  res.locals.title = "error";
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500).render("error");
});

// CORS middleware for your Electron app's server running on port 3000
app.use(cors({
  origin: 'http://127.0.0.1:3000',
  optionsSuccessStatus: 200,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Apikey']
}));

// CORS middleware for your Electron app's server running on port 3000
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Handle OPTIONS requests for the third-party server running on port 5001
app.options('/lpk/api/v1/kiosk/banknote', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Apikey'); // Add 'Apikey' to the list of allowed headers
  res.status(200).end();
});

// Catch-all route for handling 404 errors
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const server = http.createServer(app);

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
