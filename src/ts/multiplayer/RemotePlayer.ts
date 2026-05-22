import * as THREE from 'three';
import { World } from '../world/World';
import { IUpdatable } from '../interfaces/IUpdatable';
import { PeerState } from './MultiplayerClient';

export class RemotePlayer implements IUpdatable
{
	public updateOrder: number = 2;

	private group: THREE.Group;
	private targetPos: THREE.Vector3;
	private targetQuat: THREE.Quaternion;

	constructor(private world: World, public peer: PeerState)
	{
		this.group = new THREE.Group();
		this.targetPos = new THREE.Vector3(peer.px, peer.py, peer.pz);
		this.targetQuat = new THREE.Quaternion(peer.qx, peer.qy, peer.qz, peer.qw);

		this.buildMesh();

		this.group.position.copy(this.targetPos);
		this.group.quaternion.copy(this.targetQuat);

		world.graphicsWorld.add(this.group);
		world.registerUpdatable(this);
	}

	public applyState(peer: PeerState): void
	{
		this.peer = peer;
		this.targetPos.set(peer.px, peer.py, peer.pz);
		this.targetQuat.set(peer.qx, peer.qy, peer.qz, peer.qw);
	}

	public update(timestep: number, _unscaled: number): void
	{
		const alpha = 1 - Math.exp(-20 * timestep);
		this.group.position.lerp(this.targetPos, alpha);
		this.group.quaternion.slerp(this.targetQuat, alpha);
	}

	public dispose(): void
	{
		this.world.unregisterUpdatable(this);
		this.world.graphicsWorld.remove(this.group);
		this.group.traverse((obj) =>
		{
			if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite)
			{
				(obj as any).geometry?.dispose();
				const mats = Array.isArray((obj as any).material)
					? (obj as any).material
					: [(obj as any).material];
				mats.forEach((m: THREE.Material & { map?: THREE.Texture }) =>
				{
					m.map?.dispose();
					m.dispose();
				});
			}
		});
	}

	private buildMesh(): void
	{
		const color = this.colorFromId(this.peer.socketId);
		const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 });

		// Torso
		const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 10), mat);
		torso.position.y = 1.0;
		torso.castShadow = true;
		this.group.add(torso);

		// Head
		const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), mat);
		head.position.y = 1.9;
		head.castShadow = true;
		this.group.add(head);

		// Visor
		const visor = new THREE.Mesh(
			new THREE.BoxGeometry(0.45, 0.15, 0.1),
			new THREE.MeshBasicMaterial({ color: 0xffffff })
		);
		visor.position.set(0, 1.95, 0.32);
		this.group.add(visor);

		// Name label sprite
		this.group.add(this.makeLabel(this.peer.name));
	}

	private colorFromId(id: string): number
	{
		let h = 0;
		for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
		return new THREE.Color().setHSL(((h >>> 0) % 360) / 360, 0.75, 0.55).getHex();
	}

	private makeLabel(text: string): THREE.Sprite
	{
		const W = 256, H = 64;
		const canvas = document.createElement('canvas');
		canvas.width = W; canvas.height = H;
		const ctx = canvas.getContext('2d')!;

		ctx.fillStyle = 'rgba(0,0,0,0.55)';
		ctx.fillRect(0, 0, W, H);

		ctx.font = 'bold 26px Arial,sans-serif';
		ctx.fillStyle = '#ffffff';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, W / 2, H / 2);

		const sprite = new THREE.Sprite(
			new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false })
		);
		sprite.scale.set(1.8, 0.45, 1);
		sprite.position.set(0, 2.6, 0);
		return sprite;
	}
}
