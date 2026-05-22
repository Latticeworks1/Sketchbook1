import * as THREE from 'three';
import * as CANNON from 'cannon';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Character } from '../characters/Character';
import { World } from '../world/World';
import { PeerState } from './MultiplayerClient';

// ── Shared GLTF cache — only load boxman.glb once ──────────────────────────
let cachedGltf: any = null;
const pendingCallbacks: Array<(gltf: any) => void> = [];
let loading = false;

function loadBoxman(cb: (gltf: any) => void): void
{
	if (cachedGltf) { cb(cachedGltf); return; }
	pendingCallbacks.push(cb);
	if (loading) return;
	loading = true;
	new GLTFLoader().load('build/assets/boxman.glb', (gltf) =>
	{
		cachedGltf = gltf;
		pendingCallbacks.splice(0).forEach(fn => fn(gltf));
	});
}

// ── RemoteCharacter ────────────────────────────────────────────────────────
export class RemoteCharacter extends Character
{
	private targetPos: THREE.Vector3;
	private targetQuat: THREE.Quaternion;
	private targetTiltZ: number = 0;
	private lastState: string = '';

	constructor(gltf: any, peer: PeerState)
	{
		super(gltf);

		this.targetPos = new THREE.Vector3(peer.px, peer.py, peer.pz);
		this.targetQuat = new THREE.Quaternion(peer.qx, peer.qy, peer.qz, peer.qw);

		// Kinematic body: we set its position, physics won't simulate it
		(this.characterCapsule.body as any).type = CANNON.Body.KINEMATIC;
		// Disable ground-snapping callbacks — they are for local player only
		// and would fight our network-driven position every physics step.
		this.characterCapsule.body.preStep = null;
		this.characterCapsule.body.postStep = null;

		// Snap to spawn position immediately
		this.position.copy(this.targetPos);
		this.quaternion.copy(this.targetQuat);
		this.characterCapsule.body.position.set(peer.px, peer.py, peer.pz);
		this.characterCapsule.body.interpolatedPosition.set(peer.px, peer.py, peer.pz);

		this.setAnimation('idle', 0);
	}

	// ── Network update ─────────────────────────────────────────────────────
	public applyNetworkState(peer: PeerState): void
	{
		this.targetPos.set(peer.px, peer.py, peer.pz);
		this.targetQuat.set(peer.qx, peer.qy, peer.qz, peer.qw);
		this.targetTiltZ = peer.tiltZ ?? 0;

		if (peer.state !== this.lastState)
		{
			this.setAnimation(peer.state, 0.1);
			this.lastState = peer.state;
		}

		if (this.mixer && peer.animT !== undefined)
			this.mixer.setTime(peer.animT);

		// Hide body mesh while riding in a vehicle (same as local character)
		if (this.modelContainer)
			this.modelContainer.visible = (peer.vehicleId == null);
	}

	// ── Override update: skip state machine, drive from network ───────────
	public update(timeStep: number): void
	{
		const alpha = 1 - Math.exp(-20 * timeStep);
		this.position.lerp(this.targetPos, alpha);
		this.quaternion.slerp(this.targetQuat, alpha);
		this.tiltContainer.rotation.z += (this.targetTiltZ - this.tiltContainer.rotation.z) * alpha;

		if (this.mixer !== undefined) this.mixer.update(timeStep);

		// Keep kinematic body in sync with visual
		const p = this.position;
		this.characterCapsule.body.position.set(p.x, p.y, p.z);
		this.characterCapsule.body.interpolatedPosition.set(p.x, p.y, p.z);

		this.updateMatrixWorld();
	}

	// ── Don't push into world.characters so it's never snapshotted ────────
	public addToWorld(world: World): void
	{
		(this as any).world = world;
		world.physicsWorld.addBody(this.characterCapsule.body);

		if (!world.headless)
		{
			world.graphicsWorld.add(this);
			world.graphicsWorld.add(this.raycastBox);
			this.materials.forEach(mat => world.sky.csm.setupMaterial(mat));
		}
	}

	public removeFromWorld(world: World): void
	{
		(this as any).world = undefined;
		world.physicsWorld.remove(this.characterCapsule.body);

		if (!world.headless)
		{
			world.graphicsWorld.remove(this);
			world.graphicsWorld.remove(this.raycastBox);
		}
	}

	// ── Factory: async spawn, clones GLTF so each player has own skeleton ─
	public static spawn(world: World, peer: PeerState, onReady: (rc: RemoteCharacter) => void): void
	{
		loadBoxman((srcGltf) =>
		{
			const clonedScene = SkeletonUtils.clone(srcGltf.scene);
			const gltf = { scene: clonedScene, animations: srcGltf.animations };
			const rc = new RemoteCharacter(gltf, peer);
			world.add(rc);
			onReady(rc);
		});
	}
}
