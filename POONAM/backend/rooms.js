"use strict";

const crypto = require("node:crypto");

const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const ROOM_ID_PATTERN = /^[A-F0-9]{32}$/;
const rooms = new Map();
const socketRooms = new Map();

function createRoomId() {
  let roomId;
  do {
    roomId = crypto.randomBytes(16).toString("hex").toUpperCase();
  } while (rooms.has(roomId));
  return roomId;
}

function getRoom(roomId) {
  if (typeof roomId !== "string") return null;
  const normalized = roomId.trim().toUpperCase();
  if (!ROOM_ID_PATTERN.test(normalized)) return null;
  const room = rooms.get(normalized);
  if (!room) return null;
  if (Date.now() - room.createdAt > ROOM_TTL_MS) {
    removeRoom(normalized);
    return null;
  }
  return room;
}

function removeRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.call && room.call.timeout) clearTimeout(room.call.timeout);
  for (const socketId of room.participants) socketRooms.delete(socketId);
  rooms.delete(roomId);
}

function create(socketId) {
  const roomId = createRoomId();
  const room = {
    createdAt: Date.now(),
    participants: new Set([socketId]),
    call: null
  };
  rooms.set(roomId, room);
  socketRooms.set(socketId, roomId);
  return { roomId, room };
}

function join(roomId, socketId) {
  const normalizedRoomId = typeof roomId === "string" ? roomId.trim().toUpperCase() : "";
  const room = getRoom(normalizedRoomId);
  if (!room) return { error: "ROOM_NOT_FOUND" };
  const currentRoomId = socketRooms.get(socketId);
  if (currentRoomId) {
    if (currentRoomId === normalizedRoomId && room.participants.has(socketId)) {
      return { roomId: normalizedRoomId, room, alreadyJoined: true };
    }
    return { error: "ALREADY_IN_ROOM" };
  }
  if (room.participants.size >= 2) return { error: "ROOM_FULL" };
  room.participants.add(socketId);
  socketRooms.set(socketId, normalizedRoomId);
  return { roomId: normalizedRoomId, room };
}

function leave(socketId) {
  const roomId = socketRooms.get(socketId);
  if (!roomId) return null;
  const room = rooms.get(roomId);
  socketRooms.delete(socketId);
  if (!room) return { roomId, room: null, remaining: [] };
  room.participants.delete(socketId);
  if (room.call && room.call.timeout) clearTimeout(room.call.timeout);
  if (room.call) room.call = null;
  const remaining = Array.from(room.participants);
  if (remaining.length === 0) rooms.delete(roomId);
  return { roomId, room, remaining };
}

function roomForSocket(socketId) {
  const roomId = socketRooms.get(socketId);
  const room = roomId ? getRoom(roomId) : null;
  if (!room || !room.participants.has(socketId)) return null;
  return { roomId, room };
}

module.exports = {
  create,
  getRoom,
  join,
  leave,
  removeRoom,
  roomForSocket
};
