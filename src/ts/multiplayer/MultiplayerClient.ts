import * as CANNON from 'cannon';
import { io, Socket } from 'socket.io-client';
import { World } from '../world/World';
import { takeSnapshot, VehicleSnap } from '../core/Snapshot';
import { RemoteCharacter } from './RemoteCharacter';

export interface PeerState
{
	socketId: string;
	clientId: string;
	name: string;
	px: number; py: number; pz: number;
	qx: number; qy: number; qz: number; qw: number;
	tiltZ: number;
	state: string;
	animT: number;
	vehicleId: number | null;
	tick: number;
	vehicles?: VehicleSnap[];
}

export interface MultiplayerClientOptions
{
	clientId?: string;
	syncInterval?: number;
	debug?: boolean;
}

export class MultiplayerClient
{
	public socket: Socket | undefined;
	public connected: boolean = false;
	public self: PeerState | undefined;
	public peers: Map<string, PeerState> = new Map();

	public onConnected: (() => void) | undefined;
	public onDisconnected: (() => void) | undefined;
	public onPeerJoined: ((peer: PeerState) => void) | undefined;
	public onPeerLeft: ((socketId: string) => void) | undefined;
	public onPeerMoved: ((peer: PeerState) => void) | undefined;

	private remotePlayers: Map<string, RemoteCharacter> = new Map();
	// Peers whose first peerMoved hasn't arrived yet — don't spawn until we have a real position
	private pendingSpawn: Set<string> = new Set();
	// keyed by vehicle index in world.vehicles
	private puppetedVehicles: Map<number, { vehicle: any; origType: number; ownerSocketId: string }> = new Map();
	private latestVehicleSnaps: Map<number, VehicleSnap> = new Map();
	private peerVehicles: Map<string, Set<number>> = new Map();
	private syncHandle: ReturnType<typeof setInterval> | undefined;
	private options: Required<MultiplayerClientOptions>;

	constructor(
		public url: string,
		public world: World,
		options: MultiplayerClientOptions = {}
	)
	{
		this.options = {
			clientId: options.clientId || Math.random().toString(36).substring(2, 11),
			syncInterval: options.syncInterval ?? 50,
			debug: options.debug ?? false,
		};
	}

	public connect(): void
	{
		if (this.socket) return;

		this.world.vehiclePuppetCallback = () => this.syncPuppetedVehicles();

		this.socket = io(this.url, {
			transports: ['websocket'],
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionAttempts: Infinity,
		});

		this.socket.on('connect', () =>
		{
			this.connected = true;
			this._log('connected as', this.socket!.id);
			this.socket!.emit('join', { clientId: this.options.clientId });
		});

		this.socket.on('welcome', ({ self, peers }: { self: PeerState; peers: PeerState[] }) =>
		{
			this.self = self;
			this.peers.clear();

			// Spawn ghost for every peer already in the room
			peers.forEach(p =>
			{
				this.peers.set(p.socketId, p);
				this.spawnRemotePlayer(p);
			});

			this._log('welcome — peers online:', peers.length);
			this.startSync();
			if (this.onConnected) this.onConnected();
		});

		this.socket.on('peerJoined', (peer: PeerState) =>
		{
			this.peers.set(peer.socketId, peer);
			// Don't spawn yet — server position starts at a default that may float.
			// Wait for the first peerMoved so we use the real physics position.
			this.pendingSpawn.add(peer.socketId);
			this._log('peerJoined', peer.name);
			if (this.onPeerJoined) this.onPeerJoined(peer);
		});

		this.socket.on('peerMoved', (data: PeerState) =>
		{
			const peer = this.peers.get(data.socketId);
			if (peer) Object.assign(peer, data);
			else this.peers.set(data.socketId, data);

			// First real position from this peer — spawn now at the correct location
			if (this.pendingSpawn.has(data.socketId))
			{
				this.pendingSpawn.delete(data.socketId);
				this.spawnRemotePlayer(this.peers.get(data.socketId)!);
			}

			const rp = this.remotePlayers.get(data.socketId);
			if (rp) rp.applyNetworkState(data);

			if (data.vehicles && data.vehicles.length > 0)
				this.applyVehicleSnaps(data.socketId, data.vehicles);
			else
				this.releaseVehicles(data.socketId);

			if (this.onPeerMoved) this.onPeerMoved(data);
		});

		this.socket.on('peerLeft', (socketId: string) =>
		{
			const peer = this.peers.get(socketId);
			if (peer) this._log('peerLeft', peer.name);
			this.peers.delete(socketId);
			this.pendingSpawn.delete(socketId);
			this.releaseVehicles(socketId);
			this.despawnRemotePlayer(socketId);
			if (this.onPeerLeft) this.onPeerLeft(socketId);
		});

		this.socket.on('joinError', (msg: string) =>
		{
			console.warn('[MultiplayerClient] join error:', msg);
		});

		this.socket.on('disconnect', (reason: string) =>
		{
			this.connected = false;
			this.stopSync();
			this.remotePlayers.forEach((rc) => this.world.remove(rc));
			this.remotePlayers.clear();
			this.pendingSpawn.clear();
			this.puppetedVehicles.forEach(info => { info.vehicle.collision.type = info.origType; });
			this.puppetedVehicles.clear();
			this.latestVehicleSnaps.clear();
			this.peerVehicles.clear();
			this.peers.clear();
			this._log('disconnected:', reason);
			if (this.onDisconnected) this.onDisconnected();
		});

		this.socket.on('chat', ({ name, text }: { name: string; text: string }) =>
		{
			console.info(`[chat] ${name}: ${text}`);
		});
	}

	public disconnect(): void
	{
		this.world.vehiclePuppetCallback = undefined;
		this.stopSync();
		this.remotePlayers.forEach((rc) => this.world.remove(rc));
		this.remotePlayers.clear();
		this.pendingSpawn.clear();
		this.puppetedVehicles.forEach(info => { info.vehicle.collision.type = info.origType; });
		this.puppetedVehicles.clear();
		this.latestVehicleSnaps.clear();
		this.peerVehicles.clear();
		this.socket?.disconnect();
		this.socket = undefined;
		this.connected = false;
	}

	public sendChat(text: string): void
	{
		this.socket?.emit('chat', text);
	}

	private spawnRemotePlayer(peer: PeerState): void
	{
		const socketId = peer.socketId;
		if (this.remotePlayers.has(socketId)) return;
		RemoteCharacter.spawn(this.world, peer, (rc) =>
		{
			this.remotePlayers.set(socketId, rc);
			// Re-apply latest state in case further peerMoved arrived while GLTF was loading
			const latest = this.peers.get(socketId);
			if (latest) rc.applyNetworkState(latest);
		});
	}

	private despawnRemotePlayer(socketId: string): void
	{
		const rc = this.remotePlayers.get(socketId);
		if (rc)
		{
			this.world.remove(rc);
			this.remotePlayers.delete(socketId);
		}
	}

	private startSync(): void
	{
		if (this.syncHandle !== undefined) return;
		this.syncHandle = setInterval(() => this.sendMove(), this.options.syncInterval);
	}

	private stopSync(): void
	{
		if (this.syncHandle !== undefined)
		{
			clearInterval(this.syncHandle);
			this.syncHandle = undefined;
		}
	}

	private sendMove(): void
	{
		if (!this.connected || !this.world.characters.length) return;

		const snap = takeSnapshot(this.world);
		if (!snap.chars.length) return;

		const c = snap.chars[0];
		const char = this.world.characters[0];
		const animT = char?.mixer ? ((char.mixer as any).time ?? 0) : 0;
		const tiltZ = char?.tiltContainer?.rotation?.z ?? 0;

		this.socket!.emit('move', {
			px: c.px, py: c.py, pz: c.pz,
			qx: c.qx, qy: c.qy, qz: c.qz, qw: c.qw,
			tiltZ,
			state: c.state,
			animT,
			vehicleId: c.vehicleId,
			vehicles: snap.vehicles,
			tick: snap.tick,
		});
	}

	// Called on peerMoved — registers ownership and stores latest state; no physics writes here.
	private applyVehicleSnaps(socketId: string, snaps: VehicleSnap[]): void
	{
		const snapIds = new Set(snaps.map(s => s.id));

		// Release any vehicle this peer was driving that isn't in the new snap
		const prevIds = this.peerVehicles.get(socketId);
		if (prevIds) prevIds.forEach(id => { if (!snapIds.has(id)) this.releaseVehicle(id, socketId); });

		this.peerVehicles.set(socketId, snapIds);

		snaps.forEach(snap =>
		{
			// snap.id is the index in world.vehicles — consistent across all clients
			const vehicle = (this.world.vehicles as any[])[snap.id];
			if (!vehicle) return;

			const existing = this.puppetedVehicles.get(snap.id);

			// Don't let a second peer steal a vehicle already owned by someone else
			if (existing && existing.ownerSocketId !== socketId) return;

			if (!existing)
			{
				this.puppetedVehicles.set(snap.id, {
					vehicle,
					origType: vehicle.collision.type,
					ownerSocketId: socketId,
				});
				vehicle.collision.type = CANNON.Body.KINEMATIC;
			}

			// Store snap; physics writes happen in syncPuppetedVehicles() after the physics step
			this.latestVehicleSnaps.set(snap.id, snap);
		});
	}

	// Called by World.vehiclePuppetCallback — runs after physicsWorld.step(), before Vehicle.update().
	// This is the only place we write to the cannon body so Vehicle.update() reads the right interpolatedPosition.
	private syncPuppetedVehicles(): void
	{
		this.puppetedVehicles.forEach((info, idx) =>
		{
			const snap = this.latestVehicleSnaps.get(idx);
			if (!snap) return;
			const b = info.vehicle.collision;
			b.position.set(snap.px, snap.py, snap.pz);
			b.quaternion.set(snap.qx, snap.qy, snap.qz, snap.qw);
			b.interpolatedPosition.set(snap.px, snap.py, snap.pz);
			b.interpolatedQuaternion.set(snap.qx, snap.qy, snap.qz, snap.qw);
			b.velocity.set(snap.vx, snap.vy, snap.vz);
			b.angularVelocity.set(snap.avx, snap.avy, snap.avz);
		});
	}

	private releaseVehicles(socketId: string): void
	{
		const ids = this.peerVehicles.get(socketId);
		if (!ids) return;
		ids.forEach(id => this.releaseVehicle(id, socketId));
		this.peerVehicles.delete(socketId);
	}

	private releaseVehicle(id: number, socketId: string): void
	{
		const info = this.puppetedVehicles.get(id);
		if (!info || info.ownerSocketId !== socketId) return;
		info.vehicle.collision.type = info.origType;
		this.puppetedVehicles.delete(id);
		this.latestVehicleSnaps.delete(id);
	}

	private _log(...args: any[]): void
	{
		if (this.options.debug) console.debug('[MultiplayerClient]', ...args);
	}
}
