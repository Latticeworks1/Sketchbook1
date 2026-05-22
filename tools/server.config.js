'use strict';

/**
 * Sketchbook multiplayer server configuration.
 * Edit this file to tune the server without touching server code.
 * All values can also be overridden via environment variables.
 */
module.exports = {
    // ── Network ────────────────────────────────────────────────────────────────
    PORT: Number(process.env.PORT) || 8080,

    // Comma-separated allowed CORS origins, or '*' for any.
    CORS_ORIGINS: process.env.CORS_ORIGINS || '*',

    // Socket.io keepalive — increase on high-latency links
    PING_INTERVAL_MS: 10_000,
    PING_TIMEOUT_MS:   5_000,

    // ── Players ────────────────────────────────────────────────────────────────
    MAX_PLAYERS: Number(process.env.MAX_PLAYERS) || 60,

    // How many milliseconds must pass before the server accepts another
    // 'move' event from the same client (rate-limit against flood).
    MOVE_RATE_LIMIT_MS: 20,

    // ── Chat ───────────────────────────────────────────────────────────────────
    CHAT_MAX_LENGTH: 200,

    // ── Vehicles ───────────────────────────────────────────────────────────────
    // A client can only be the authoritative driver of this many vehicles
    // at once (normally 1 — you can only sit in one seat).
    MAX_VEHICLES_PER_PLAYER: 1,

    // After a driver disconnects, other clients are told to release the
    // vehicle immediately. If you want a brief grace period before the
    // vehicle snaps back to simulated physics, set this (ms).
    VEHICLE_RELEASE_DELAY_MS: 0,

    // ── Respawn ────────────────────────────────────────────────────────────────
    // Future: time in ms before a disconnected player's slot is freed
    // (currently unused — slot is freed immediately on disconnect).
    PLAYER_SLOT_RELEASE_DELAY_MS: 0,
};
