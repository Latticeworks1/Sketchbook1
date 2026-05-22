import { Character } from '../characters/Character';
import { World } from '../world/World';
import { PeerState } from './MultiplayerClient';
export declare class RemoteCharacter extends Character {
    private targetPos;
    private targetQuat;
    private targetTiltZ;
    private lastState;
    constructor(gltf: any, peer: PeerState);
    applyNetworkState(peer: PeerState): void;
    update(timeStep: number): void;
    addToWorld(world: World): void;
    removeFromWorld(world: World): void;
    static spawn(world: World, peer: PeerState, onReady: (rc: RemoteCharacter) => void): void;
}
