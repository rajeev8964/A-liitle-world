"use strict";

const path = require("node:path");
const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const { registerSignaling } = require("./signaling");

const app = express();
const server = createServer(app);
const allowedOrigin = process.env.FRONTEND_ORIGIN;
const io = new Server(server, {
  serveClient: true,
  cors: {
    origin(origin, callback) {
      if (!origin || !allowedOrigin || origin === allowedOrigin) callback(null, true);
      else callback(new Error("Origin is not allowed."));
    }
  },
  maxHttpBufferSize: 64 * 1024,
  allowRequest(request, callback) {
    const origin = request.headers.origin;
    if (!origin) {
      callback(null, true);
      return;
    }
    let sameOrigin = false;
    try {
      sameOrigin = new URL(origin).host === request.headers.host;
    } catch (error) {
      sameOrigin = false;
    }
    callback(null, sameOrigin || origin === allowedOrigin);
  }
});

const projectRoot = path.resolve(__dirname, "..");
const turnUrls = (process.env.TURN_URLS || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.get("/api/config", (request, response) => {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  if (turnUrls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({
      urls: turnUrls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    });
  }
  response.set("Cache-Control", "no-store");
  response.json({ iceServers });
});
app.use("/backend", (request, response) => response.sendStatus(404));
app.use(express.static(projectRoot, {
  dotfiles: "deny",
  index: "index.html",
  setHeaders(response) {
    response.set("X-Content-Type-Options", "nosniff");
  }
}));

registerSignaling(io);

const port = Number(process.env.PORT) || 3000;
server.listen(port, "0.0.0.0", () => {
  console.log(`A Little World is listening on port ${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    io.close(() => process.exit(0));
  });
}
