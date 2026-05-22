import { Socket } from 'socket.io-client';
import { World } from '../world/World';
import { VehicleSnap } from '../core/Snapshot';
export interface PeerState {
    socketId: string;
    clientId: string;
    name: string;
    px: number;
    py: number;
    pz: number;
    qx: number;
    qy: number;
    qz: number;
    qw: number;
    tiltZ: number;
    state: string;
    animT: number;
    vehicleId: number | null;
    tick: number;
    vehicles?: VehicleSnap[];
}
export interface MultiplayerClientOptions {
    clientId?: string;
    syncInterval?: number;
    debug?: boolean;
}
export declare class MultiplayerClient {
    url: string;
    world: World;
    socket: Socket | undefined;
    connected: boolean;
    self: PeerState | undefined;
    peers: Map<string, PeerState>;
    onConnected: (() => void) | undefined;
    onDisconnected: (() => void) | undefined;
    onPeerJoined: ((peer: PeerState) => void) | undefined;
    onPeerLeft: ((socketId: string) => void) | undefined;
    onPeerMoved: ((peer: PeerState) => void) | undefined;
    private remotePlayers;
    private pendingSpawn;
    private puppetedVehicles;
    private latestVehicleSnaps;
    private peerVehicles;
    private syncHandle;
    private options;
    constructor(url: string, world: World, options?: MultiplayerClientOptions);
    connect(): void;
    disconnect(): void;
    sendChat(text: string): void;
    private spawnRemotePlayer;
    private despawnRemotePlayer;
    private startSync;
    private stopSync;
    private sendMove;
    private applyVehicleSnaps;
    private syncPuppetedVehicles;
    private releaseVehicles;
    private releaseVehicle;
    private _log;
}
