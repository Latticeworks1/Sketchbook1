export interface EntitySnap {
    id: number;
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
}
export interface VehicleSnap {
    id: number;
    px: number;
    py: number;
    pz: number;
    qx: number;
    qy: number;
    qz: number;
    qw: number;
    vx: number;
    vy: number;
    vz: number;
    avx: number;
    avy: number;
    avz: number;
}
export interface WorldSnapshot {
    tick: number;
    chars: EntitySnap[];
    vehicles: VehicleSnap[];
    full?: boolean;
}
export declare function takeSnapshot(world: {
    tick: number;
    characters: any[];
    vehicles: any[];
}): WorldSnapshot;
