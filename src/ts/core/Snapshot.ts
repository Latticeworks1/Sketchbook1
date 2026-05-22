export interface EntitySnap
{
	id: number;
	px: number; py: number; pz: number;
	// Visual quaternion (character.quaternion), NOT physics body (which has fixedRotation)
	qx: number; qy: number; qz: number; qw: number;
	tiltZ: number;          // tiltContainer.rotation.z — lean during turning
	state: string;          // current animation clip name (e.g. 'run', 'idle')
	animT: number;          // time within current clip for phase sync
	vehicleId: number | null; // THREE.Object3D.id of occupied vehicle, or null
}

export interface VehicleSnap
{
	id: number;
	px: number; py: number; pz: number;
	qx: number; qy: number; qz: number; qw: number;
	vx: number; vy: number; vz: number;     // linear velocity
	avx: number; avy: number; avz: number;  // angular velocity
}

export interface WorldSnapshot
{
	tick: number;
	chars: EntitySnap[];
	vehicles: VehicleSnap[];
	full?: boolean;
}

function serializeCharacter(c: any): EntitySnap
{
	const p = c.characterCapsule.body.interpolatedPosition;
	const q = c.quaternion; // THREE.Object3D visual quaternion — body is fixedRotation
	return {
		id: c.id,
		px: p.x, py: p.y, pz: p.z,
		qx: q.x, qy: q.y, qz: q.z, qw: q.w,
		tiltZ: c.tiltContainer?.rotation?.z ?? 0,
		state: c.currentAnimationName ?? 'idle',
		animT: 0, // filled in by caller who has access to the mixer action
		vehicleId: c.occupyingSeat?.vehicle?.id ?? null,
	};
}

function serializeVehicle(v: any, idx: number): VehicleSnap
{
	const p = v.collision.interpolatedPosition;
	const q = v.collision.interpolatedQuaternion;
	const vel = v.collision.velocity;
	const avel = v.collision.angularVelocity;
	return {
		id: idx, // index in world.vehicles — stable across clients unlike THREE.Object3D.id
		px: p.x, py: p.y, pz: p.z,
		qx: q.x, qy: q.y, qz: q.z, qw: q.w,
		vx: vel.x, vy: vel.y, vz: vel.z,
		avx: avel.x, avy: avel.y, avz: avel.z,
	};
}

function entitySnapEquals(a: EntitySnap, b: EntitySnap): boolean
{
	return a.px === b.px && a.py === b.py && a.pz === b.pz &&
		a.qx === b.qx && a.qy === b.qy && a.qz === b.qz && a.qw === b.qw &&
		a.tiltZ === b.tiltZ && a.state === b.state && a.vehicleId === b.vehicleId;
}

export function takeSnapshot(world: { tick: number; characters: any[]; vehicles: any[] }): WorldSnapshot
{
	return {
		tick: world.tick,
		full: true,
		chars: world.characters.map(serializeCharacter),
		vehicles: world.vehicles
			.map((v, idx) => v.controllingCharacter != null ? serializeVehicle(v, idx) : null)
			.filter(Boolean) as VehicleSnap[],
	};
}
