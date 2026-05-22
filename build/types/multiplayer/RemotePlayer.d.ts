import { World } from '../world/World';
import { IUpdatable } from '../interfaces/IUpdatable';
import { PeerState } from './MultiplayerClient';
export declare class RemotePlayer implements IUpdatable {
    private world;
    peer: PeerState;
    updateOrder: number;
    private group;
    private targetPos;
    private targetQuat;
    constructor(world: World, peer: PeerState);
    applyState(peer: PeerState): void;
    update(timestep: number, _unscaled: number): void;
    dispose(): void;
    private buildMesh;
    private colorFromId;
    private makeLabel;
}
