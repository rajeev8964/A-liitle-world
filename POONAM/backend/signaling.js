"use strict";

const rooms = require("./rooms");

function acknowledge(callback, response) {
  if (typeof callback === "function") callback(response);
}

function roomPayload(roomId, room, socketId) {
  return {
    roomId,
    participantCount: room.participants.size,
    peerId: Array.from(room.participants).find((id) => id !== socketId) || null
  };
}

function registerSignaling(io) {
  io.on("connection", (socket) => {
    socket.on("room:create", (callback) => {
      if (rooms.roomForSocket(socket.id)) {
        acknowledge(callback, { ok: false, code: "ALREADY_IN_ROOM" });
        return;
      }
      const { roomId, room } = rooms.create(socket.id);
      socket.join(roomId);
      acknowledge(callback, { ok: true, ...roomPayload(roomId, room, socket.id) });
    });

    socket.on("room:join", (payload, callback) => {
      const roomId = typeof payload === "object" && payload ? payload.roomId : "";
      const result = rooms.join(roomId, socket.id);
      if (result.error) {
        acknowledge(callback, { ok: false, code: result.error });
        return;
      }
      socket.join(result.roomId);
      const response = { ok: true, ...roomPayload(result.roomId, result.room, socket.id) };
      acknowledge(callback, response);
      if (!result.alreadyJoined) {
        socket.to(result.roomId).emit("room:peer-joined", {
          peerId: socket.id,
          participantCount: result.room.participants.size
        });
      }
    });

    socket.on("call:invite", (payload, callback) => {
      const current = rooms.roomForSocket(socket.id);
      const mode = payload && payload.mode;
      if (!current || current.room.participants.size !== 2) {
        acknowledge(callback, { ok: false, code: "PEER_NOT_PRESENT" });
        return;
      }
      if (mode !== "audio" && mode !== "video") {
        acknowledge(callback, { ok: false, code: "INVALID_MODE" });
        return;
      }
      if (current.room.call) {
        acknowledge(callback, { ok: false, code: "CALL_IN_PROGRESS" });
        return;
      }
      current.room.call = { callerId: socket.id, mode, status: "ringing" };
      socket.to(current.roomId).emit("call:incoming", { mode });
      acknowledge(callback, { ok: true });
    });

    socket.on("call:accept", (callback) => {
      const current = rooms.roomForSocket(socket.id);
      const call = current && current.room.call;
      if (!call || call.status !== "ringing" || call.callerId === socket.id) {
        acknowledge(callback, { ok: false, code: "NO_INCOMING_CALL" });
        return;
      }
      call.status = "active";
      socket.to(current.roomId).emit("call:accepted");
      acknowledge(callback, { ok: true, mode: call.mode });
    });

    socket.on("call:reject", (callback) => {
      const current = rooms.roomForSocket(socket.id);
      const call = current && current.room.call;
      if (!call || call.status !== "ringing" || call.callerId === socket.id) {
        acknowledge(callback, { ok: false, code: "NO_INCOMING_CALL" });
        return;
      }
      current.room.call = null;
      socket.to(current.roomId).emit("call:rejected");
      acknowledge(callback, { ok: true });
    });

    socket.on("call:end", (callback) => {
      const current = rooms.roomForSocket(socket.id);
      if (!current || !current.room.call) {
        acknowledge(callback, { ok: false, code: "NO_ACTIVE_CALL" });
        return;
      }
      current.room.call = null;
      socket.to(current.roomId).emit("call:ended");
      acknowledge(callback, { ok: true });
    });

    socket.on("webrtc:offer", (description, callback) => {
      relayDescription(socket, description, callback, "offer");
    });

    socket.on("webrtc:answer", (description, callback) => {
      relayDescription(socket, description, callback, "answer");
    });

    socket.on("webrtc:ice-candidate", (candidate, callback) => {
      const current = rooms.roomForSocket(socket.id);
      if (!current || !current.room.call || current.room.call.status !== "active" ||
          !candidate || typeof candidate !== "object") {
        acknowledge(callback, { ok: false, code: "CALL_NOT_ACTIVE" });
        return;
      }
      socket.to(current.roomId).emit("webrtc:ice-candidate", candidate);
      acknowledge(callback, { ok: true });
    });

    socket.on("room:leave", (callback) => {
      leaveRoom(socket, io);
      acknowledge(callback, { ok: true });
    });

    socket.on("disconnect", () => leaveRoom(socket, io));
  });
}

function relayDescription(socket, description, callback, type) {
  const current = rooms.roomForSocket(socket.id);
  const call = current && current.room.call;
  if (!call || call.status !== "active" || !description ||
      typeof description !== "object" || typeof description.sdp !== "string") {
    acknowledge(callback, { ok: false, code: "CALL_NOT_ACTIVE" });
    return;
  }
  const isCaller = call.callerId === socket.id;
  if ((type === "offer" && !isCaller) || (type === "answer" && isCaller)) {
    acknowledge(callback, { ok: false, code: "INVALID_CALLER" });
    return;
  }
  socket.to(current.roomId).emit(`webrtc:${type}`, description);
  acknowledge(callback, { ok: true });
}

function leaveRoom(socket, io) {
  const result = rooms.leave(socket.id);
  if (!result) return;
  socket.leave(result.roomId);
  for (const peerId of result.remaining) {
    io.to(peerId).emit("room:peer-left", {
      participantCount: result.remaining.length
    });
  }
  if (result.room && result.room.participants.size === 0) {
    rooms.removeRoom(result.roomId);
  }
}

module.exports = { registerSignaling };
