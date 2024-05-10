import { app, globalShortcut, BrowserWindow, ipcMain,screen  } from "electron";
import { Readable } from "stream";
import { spawn } from "child_process";
import path from "path";
import fetch from "node-fetch";
import { name } from "../package.json";
import fs from "fs";
const appName = app.getPath("exe");
const expressAppUrl = "http://127.0.0.1:3000";
let mainWindow: BrowserWindow | null;

// Path to log file
const logFilePath = path.join(app.getPath("userData"), "app.log");


const expressPath = appName.endsWith(`${name}.exe`)
  ? path.join("./resources/app.asar", "./dist/src/express-app.js")
  : "./dist/src/express-app.js";

function stripAnsiColors(text: string): string {
  return text.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
}

// Function to write logs to file
function writeLogToFile(logEntry: string) {
  if (!fs.existsSync(logFilePath)) {
    // File does not exist, handle accordingly (e.g., create the file)
    fs.writeFileSync(logFilePath, "");
  }

  fs.appendFile(logFilePath, `${logEntry}\n`, (err) => {
    if (err) {
      console.error("Error writing to log file:", err);
    }
  });
}

writeLogToFile("Application started");

function redirectOutput(stream: Readable) {
  stream.on("data", (data: any) => {
    if (!mainWindow) return;
    data.toString().split("\n").forEach((line: string) => {
      if (line !== "") {
        mainWindow!.webContents.send("server-log-entry", stripAnsiColors(line));
      }
    });
  });
}

function registerGlobalShortcuts() {
  globalShortcut.register("CommandOrControl+Shift+L", () => {
    mainWindow!.webContents.send("show-server-log");
  });
}

function unregisterAllShortcuts() {
  globalShortcut.unregisterAll();
}

function createWindow() {
  const expressAppProcess = spawn(appName, [expressPath], { env: { ELECTRON_RUN_AS_NODE: "1" } });
  const { bounds } = screen.getPrimaryDisplay();
  [expressAppProcess.stdout, expressAppProcess.stderr].forEach(redirectOutput);

  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    fullscreen: true,
    frame: false,

    icon: path.join(__dirname, "..", "favicon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    expressAppProcess.kill();
  });

  mainWindow.on("focus", registerGlobalShortcuts);
  mainWindow.on("blur", unregisterAllShortcuts);

  ipcMain.handle("get-express-app-url", () => expressAppUrl);

  mainWindow.loadURL(`file://${__dirname}/../index.html`);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.whenReady().then(() => {
  registerGlobalShortcuts();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  const checkServerRunning = setInterval(() => {
    fetch(expressAppUrl)
      .then((response) => {
        if (response.status === 200) {
          clearInterval(checkServerRunning);
          mainWindow!.webContents.send("server-running");
        }
      })
      .catch(() => { }); // swallow exception
  }, 1000);
});
