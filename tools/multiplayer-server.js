#!/usr/bin/env node
'use strict';

const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cfg = require('./server.config');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: cfg.CORS_ORIGINS, methods: ['GET', 'POST'] },
    pingInterval: cfg.PING_INTERVAL_MS,
    pingTimeout:  cfg.PING_TIMEOUT_MS,
});

// Serve the built game
const ROOT = path.resolve(__dirname, '..');
app.use(express.static(ROOT));
app.use((req, res) => res.sendFile(path.join(ROOT, 'index.html')));

// ── Player state ──────────────────────────────────────────────────────────────
let playerCounter = 1;
const players = {};
const lastMoveTime = {}; // rate-limit per socket

function makePlayer(socketId, clientId) {
    return {
        socketId,
        clientId: clientId || socketId,
        name: `Player ${playerCounter++}`,
        px: 0, py: 0, pz: 0,
        qx: 0, qy: 0, qz: 0, qw: 1,
        tiltZ: 0,
        state: 'idle',
        animT: 0,
        vehicleId: null,
        tick: 0,
        joinedAt: Date.now(),
    };
}

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[connect] ${socket.id}`);

    socket.on('join', ({ clientId } = {}) => {
        if (Object.keys(players).length >= cfg.MAX_PLAYERS) {
            socket.emit('joinError', `Server full (${cfg.MAX_PLAYERS}/${cfg.MAX_PLAYERS})`);
            return;
        }

        const player = makePlayer(socket.id, clientId);
        players[socket.id] = player;

        socket.emit('welcome', {
            self: player,
            peers: Object.values(players).filter(p => p.socketId !== socket.id),
        });

        socket.broadcast.emit('peerJoined', player);

        const n = Object.keys(players).length;
        console.log(`[join]  ${player.name} (${socket.id})  —  ${n}/${cfg.MAX_PLAYERS} online`);
    });

    socket.on('move', (data) => {
        const p = players[socket.id];
        if (!p) return;

        // Rate-limit
        const now = Date.now();
        if (now - (lastMoveTime[socket.id] || 0) < cfg.MOVE_RATE_LIMIT_MS) return;
        lastMoveTime[socket.id] = now;

        // Clamp vehicles per player
        const vehicles = Array.isArray(data.vehicles)
            ? data.vehicles.slice(0, cfg.MAX_VEHICLES_PER_PLAYER)
            : [];

        p.px        = data.px        ?? p.px;
        p.py        = data.py        ?? p.py;
        p.pz        = data.pz        ?? p.pz;
        p.qx        = data.qx        ?? p.qx;
        p.qy        = data.qy        ?? p.qy;
        p.qz        = data.qz        ?? p.qz;
        p.qw        = data.qw        ?? p.qw;
        p.tiltZ     = data.tiltZ     ?? p.tiltZ ?? 0;
        p.state     = data.state     ?? p.state;
        p.animT     = data.animT     ?? p.animT ?? 0;
        p.vehicleId = data.vehicleId !== undefined ? data.vehicleId : p.vehicleId;
        p.tick      = data.tick      ?? p.tick;

        socket.broadcast.emit('peerMoved', {
            socketId: socket.id,
            px: p.px, py: p.py, pz: p.pz,
            qx: p.qx, qy: p.qy, qz: p.qz, qw: p.qw,
            tiltZ: p.tiltZ,
            state: p.state,
            animT: p.animT,
            vehicleId: p.vehicleId,
            vehicles,
            tick: p.tick,
        });
    });

    socket.on('chat', (text) => {
        const p = players[socket.id];
        if (!p || typeof text !== 'string') return;
        io.emit('chat', { name: p.name, text: text.slice(0, cfg.CHAT_MAX_LENGTH) });
    });

    socket.on('disconnect', (reason) => {
        const p = players[socket.id];
        if (!p) return;
        delete players[socket.id];
        delete lastMoveTime[socket.id];
        io.emit('peerLeft', socket.id);
        const n = Object.keys(players).length;
        console.log(`[leave] ${p.name} (${reason})  —  ${n}/${cfg.MAX_PLAYERS} online`);
    });
});

httpServer.listen(cfg.PORT, '0.0.0.0', () => {
    console.log(`Sketchbook multiplayer server  →  http://localhost:${cfg.PORT}`);
    console.log(`  max ${cfg.MAX_PLAYERS} players  |  serving static from ${ROOT}`);
});
