// Aircraft role selects a shared FBX template; AI does not depend on model geometry.
import { createMigFishMesh, createMechaFishMesh } from '../assets/aircraft.js';

export function createDroneMesh(isBoss = false) {
    return isBoss ? createMechaFishMesh() : createMigFishMesh();
}
