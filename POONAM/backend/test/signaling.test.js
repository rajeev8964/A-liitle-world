"use strict";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const { io: createClient } = require("socket.io-client");
const { registerSignaling } = require("../signaling");

const httpServer = createServer();
const io = new Server(httpServer);
const clients = [];

before(async () => {
  registerSignaling(io, { callRingTimeoutMs: 50 });
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
});

after(async () => {
  clients.forEach((client) => client.disconnect());
  await new Promise((resolve) => io.close(resolve));
});

function connectClient() {
  const address = httpServer.address();
  const client = createClient(`http://127.0.0.1:${address.port}`, {
    forceNew: true,
    reconnection: false,
    transports: ["websocket"]
  });
  clients.push(client);
  return new Promise((resolve, reject) => {
    client.once("connect", () => resolve(client));
    client.once("connect_error", reject);
  });
}

function emitAck(client, event, ...args) {
  return new Promise((resolve, reject) => {
    client.timeout(2000).emit(event, ...args, (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

function waitFor(client, event) {
  return new Promise((resolve) => client.once(event, resolve));
}

test("private rooms limit membership and relay only validated call signaling", async () => {
  const caller = await connectClient();
  const callee = await connectClient();
  const thirdPerson = await connectClient();

  const created = await emitAck(caller, "room:create");
  assert.equal(created.ok, true);
  assert.match(created.roomId, /^[A-F0-9]{32}$/);

  const peerJoined = waitFor(caller, "room:peer-joined");
  const joined = await emitAck(callee, "room:join", { roomId: created.roomId.toLowerCase() });
  assert.equal(joined.ok, true);
  assert.equal(joined.peerId, caller.id);
  await peerJoined;

  assert.deepEqual(await emitAck(thirdPerson, "room:join", { roomId: "INVALID" }), {
    ok: false,
    code: "ROOM_NOT_FOUND"
  });
  assert.deepEqual(await emitAck(thirdPerson, "room:join", { roomId: created.roomId }), {
    ok: false,
    code: "ROOM_FULL"
  });

  const incomingCall = waitFor(callee, "call:incoming");
  assert.deepEqual(await emitAck(caller, "call:invite", { mode: "video" }), { ok: true });
  assert.deepEqual(await incomingCall, { mode: "video" });

  const accepted = waitFor(caller, "call:accepted");
  assert.deepEqual(await emitAck(callee, "call:accept"), { ok: true, mode: "video" });
  await accepted;

  const offer = { type: "offer", sdp: "test-sdp" };
  const receivedOffer = waitFor(callee, "webrtc:offer");
  assert.deepEqual(await emitAck(caller, "webrtc:offer", offer), { ok: true });
  assert.deepEqual(await receivedOffer, offer);
  assert.deepEqual(await emitAck(callee, "webrtc:offer", offer), {
    ok: false,
    code: "INVALID_CALLER"
  });

  const answer = { type: "answer", sdp: "test-answer-sdp" };
  const receivedAnswer = waitFor(caller, "webrtc:answer");
  assert.deepEqual(await emitAck(callee, "webrtc:answer", answer), { ok: true });
  assert.deepEqual(await receivedAnswer, answer);
  assert.deepEqual(await emitAck(caller, "webrtc:answer", answer), {
    ok: false,
    code: "INVALID_CALLER"
  });

  const candidate = {
    candidate: "candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host",
    sdpMid: "0",
    sdpMLineIndex: 0
  };
  const receivedCandidate = waitFor(callee, "webrtc:ice-candidate");
  assert.deepEqual(await emitAck(caller, "webrtc:ice-candidate", candidate), { ok: true });
  assert.deepEqual(await receivedCandidate, candidate);
  assert.deepEqual(await emitAck(thirdPerson, "webrtc:offer", offer), {
    ok: false,
    code: "CALL_NOT_ACTIVE"
  });

  const ended = waitFor(callee, "call:ended");
  assert.deepEqual(await emitAck(caller, "call:end"), { ok: true });
  await ended;

  const peerLeft = waitFor(caller, "room:peer-left");
  assert.deepEqual(await emitAck(callee, "room:leave"), { ok: true });
  assert.deepEqual(await peerLeft, { participantCount: 1 });

  const peerRejoined = waitFor(caller, "room:peer-joined");
  assert.equal((await emitAck(callee, "room:join", { roomId: created.roomId })).ok, true);
  await peerRejoined;

  const incomingAgain = waitFor(callee, "call:incoming");
  const callerTimedOut = waitFor(caller, "call:timeout");
  const calleeTimedOut = waitFor(callee, "call:timeout");
  assert.deepEqual(await emitAck(caller, "call:invite", { mode: "audio" }), { ok: true });
  await incomingAgain;
  await Promise.all([callerTimedOut, calleeTimedOut]);
  assert.deepEqual(await emitAck(caller, "call:invite", { mode: "audio" }), { ok: true });

  const peerDisconnected = waitFor(caller, "room:peer-left");
  callee.disconnect();
  assert.deepEqual(await peerDisconnected, { participantCount: 1 });
});
