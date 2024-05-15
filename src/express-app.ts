import express from "express";
import cors from "cors";
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from "path";
import logger from "morgan";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import http from "http";
import createError from "http-errors";
import { expressPort } from "../package.json";
import fs from "fs";
import { Request, Response } from 'express';

const app = express();
const router = express.Router();

const logDirectory = "D://logs";

// Function to write log messages to file
function writeLogToFile(logMessage: string) {
  const logFilePath = path.join(logDirectory, "app.log");
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }
  fs.appendFile(logFilePath, `${logMessage}\n`, (err) => {
    if (err) {
      console.error("Error writing to log file:", err);
    }
  });
}

const routes = [
  { path: "/", viewName: "index", title: "Home" },
  { path: "/pageTwo", viewName: "pageTwo", title: "Page 2" },
  { path: "/pageThree", viewName: "pageThree", title: "Page 3" },
  { path: "/pageFour", viewName: "pageFour", title: "Page 4" },
  { path: "/sendMessage", method: "post", handler: sendMessageHandler }
];

routes.forEach(({ path, viewName, title, method, handler }) => {
  if (method === "post") {
    router.post(path, handler);
  } else {
    router.get(path, (_req, res) => {
      if (viewName && title) {
        res.render(viewName, { title });
      } else {
        res.status(500).send("Internal Server Error");
      }
    });
  }
});

function sendMessageHandler(req: Request, res: Response) {
  const message = req.body.message;
  const logMessage = `[${new Date().toISOString()}] New message: ${message}`;
  console.log(logMessage);
  writeLogToFile(logMessage);
  res.json({ success: true, message: "Message received and logged" });
}

app.set("port", expressPort);
app.set("views", path.join(__dirname, "..", "views"));
app.set("view engine", "ejs");

//app.use(cors()); // Enable CORS

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
