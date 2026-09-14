import * as THREE from 'three';

export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface RayHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  buildingIndex: number;
}

const rayPoint = new THREE.Vector3();
const rayNormal = new THREE.Vector3();
const rayResult = { point: rayPoint, normal: rayNormal, distance: 0 };
const nearestRayResult = { point: new THREE.Vector3(), normal: new THREE.Vector3(), distance: 0, buildingIndex: -1 };
const nearestWallResult = {
  distance: 0,
  buildingIndex: -1,
  normal: new THREE.Vector3(),
  point: new THREE.Vector3(),
};

export function raycastAABBs(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  boxes: AABB[],
  maxDistance: number,
): RayHit | null {
  let nearestDistance = maxDistance;
  let nearestIndex = -1;
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    if (!box) continue;
    const hit = raycastAABB(origin, direction, box, maxDistance);
    if (hit && hit.distance <= nearestDistance) {
      nearestDistance = hit.distance;
      nearestIndex = index;
      nearestRayResult.point.copy(hit.point);
      nearestRayResult.normal.copy(hit.normal);
    }
  }
  if (nearestIndex < 0) return null;
  nearestRayResult.distance = nearestDistance;
  nearestRayResult.buildingIndex = nearestIndex;
  return nearestRayResult;
}

export function raycastAABB(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  box: AABB,
  maxDistance: number,
): Omit<RayHit, 'buildingIndex'> | null {
  let near = -Infinity;
  let far = Infinity;
  let nearAxis = 0;
  let nearSign = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const start = origin.getComponent(axis);
    const speed = direction.getComponent(axis);
    const min = box.min.getComponent(axis);
    const max = box.max.getComponent(axis);
    if (Math.abs(speed) < 1e-10) {
      if (start < min || start > max) return null;
      continue;
    }
    const first = (min - start) / speed;
    const last = (max - start) / speed;
    const entry = Math.min(first, last);
    if (entry > near) {
      near = entry;
      nearAxis = axis;
      nearSign = speed > 0 ? -1 : 1;
    }
    far = Math.min(far, Math.max(first, last));
  }
  if (far < 0 || near > far + 1e-8 || near > maxDistance) return null;
  if (!Number.isFinite(near)) return null;
  const distance = Math.max(0, near);
  rayPoint.copy(origin).addScaledVector(direction, distance);
  rayNormal.set(0, 0, 0).setComponent(nearAxis, nearSign);
  rayResult.distance = distance;
  return rayResult;
}

export function nearestWall(
  position: THREE.Vector3,
  boxes: AABB[],
  maxDistance: number,
): { distance: number; normal: THREE.Vector3; point: THREE.Vector3; buildingIndex: number } | null {
  let closestDistance = maxDistance;
  let found = false;
  for (const [buildingIndex, box] of boxes.entries()) {
    const insideY = position.y >= box.min.y && position.y <= box.max.y;
    if (!insideY) continue;
    const insideX = position.x >= box.min.x && position.x <= box.max.x;
    const insideZ = position.z >= box.min.z && position.z <= box.max.z;
    const minXDistance = box.min.x - position.x;
    if (insideZ && minXDistance >= 0 && minXDistance <= closestDistance) {
      closestDistance = minXDistance;
      nearestWallResult.normal.set(-1, 0, 0);
      nearestWallResult.point.set(box.min.x, position.y, position.z);
      nearestWallResult.buildingIndex = buildingIndex;
      found = true;
    }
    const maxXDistance = position.x - box.max.x;
    if (insideZ && maxXDistance >= 0 && maxXDistance <= closestDistance) {
      closestDistance = maxXDistance;
      nearestWallResult.normal.set(1, 0, 0);
      nearestWallResult.point.set(box.max.x, position.y, position.z);
      nearestWallResult.buildingIndex = buildingIndex;
      found = true;
    }
    const minZDistance = box.min.z - position.z;
    if (insideX && minZDistance >= 0 && minZDistance <= closestDistance) {
      closestDistance = minZDistance;
      nearestWallResult.normal.set(0, 0, -1);
      nearestWallResult.point.set(position.x, position.y, box.min.z);
      nearestWallResult.buildingIndex = buildingIndex;
      found = true;
    }
    const maxZDistance = position.z - box.max.z;
    if (insideX && maxZDistance >= 0 && maxZDistance <= closestDistance) {
      closestDistance = maxZDistance;
      nearestWallResult.normal.set(0, 0, 1);
      nearestWallResult.point.set(position.x, position.y, box.max.z);
      nearestWallResult.buildingIndex = buildingIndex;
      found = true;
    }
  }
  if (!found) return null;
  nearestWallResult.distance = closestDistance;
  return nearestWallResult;
}
