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

const tMin = new THREE.Vector3();
const tMax = new THREE.Vector3();
const nearestWallResult = {
  distance: 0,
  normal: new THREE.Vector3(),
  point: new THREE.Vector3(),
};

export function raycastAABBs(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  boxes: AABB[],
  maxDistance: number,
): RayHit | null {
  let nearest: RayHit | null = null;
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    if (!box) continue;
    const hit = raycastAABB(origin, direction, box, maxDistance);
    if (hit && (!nearest || hit.distance < nearest.distance)) {
      nearest = { ...hit, buildingIndex: index };
    }
  }
  return nearest;
}

export function raycastAABB(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  box: AABB,
  maxDistance: number,
): Omit<RayHit, 'buildingIndex'> | null {
  const inverse = new THREE.Vector3(
    direction.x === 0 ? Number.POSITIVE_INFINITY : 1 / direction.x,
    direction.y === 0 ? Number.POSITIVE_INFINITY : 1 / direction.y,
    direction.z === 0 ? Number.POSITIVE_INFINITY : 1 / direction.z,
  );
  tMin.set((box.min.x - origin.x) * inverse.x, (box.min.y - origin.y) * inverse.y, (box.min.z - origin.z) * inverse.z);
  tMax.set((box.max.x - origin.x) * inverse.x, (box.max.y - origin.y) * inverse.y, (box.max.z - origin.z) * inverse.z);
  const nearX = Math.min(tMin.x, tMax.x);
  const nearY = Math.min(tMin.y, tMax.y);
  const nearZ = Math.min(tMin.z, tMax.z);
  const farX = Math.max(tMin.x, tMax.x);
  const farY = Math.max(tMin.y, tMax.y);
  const farZ = Math.max(tMin.z, tMax.z);
  const near = Math.max(nearX, nearY, nearZ);
  const far = Math.min(farX, farY, farZ);
  if (far < 0 || near > far || near > maxDistance) return null;
  const distance = Math.max(0, near);
  const point = origin.clone().addScaledVector(direction, distance);
  const epsilon = 1e-4;
  const normal = new THREE.Vector3();
  if (Math.abs(point.x - box.min.x) < epsilon) normal.set(-1, 0, 0);
  else if (Math.abs(point.x - box.max.x) < epsilon) normal.set(1, 0, 0);
  else if (Math.abs(point.y - box.min.y) < epsilon) normal.set(0, -1, 0);
  else if (Math.abs(point.y - box.max.y) < epsilon) normal.set(0, 1, 0);
  else if (Math.abs(point.z - box.min.z) < epsilon) normal.set(0, 0, -1);
  else normal.set(0, 0, 1);
  return { point, normal, distance };
}

export function nearestWall(
  position: THREE.Vector3,
  boxes: AABB[],
  maxDistance: number,
): { distance: number; normal: THREE.Vector3; point: THREE.Vector3 } | null {
  let closestDistance = maxDistance;
  let found = false;
  for (const box of boxes) {
    const insideY = position.y >= box.min.y && position.y <= box.max.y;
    if (!insideY) continue;
    const minXDistance = Math.abs(position.x - box.min.x);
    if (minXDistance < closestDistance) {
      closestDistance = minXDistance;
      nearestWallResult.normal.set(-1, 0, 0);
      nearestWallResult.point.set(box.min.x, position.y, position.z);
      found = true;
    }
    const maxXDistance = Math.abs(position.x - box.max.x);
    if (maxXDistance < closestDistance) {
      closestDistance = maxXDistance;
      nearestWallResult.normal.set(1, 0, 0);
      nearestWallResult.point.set(box.max.x, position.y, position.z);
      found = true;
    }
    const minZDistance = Math.abs(position.z - box.min.z);
    if (minZDistance < closestDistance) {
      closestDistance = minZDistance;
      nearestWallResult.normal.set(0, 0, -1);
      nearestWallResult.point.set(position.x, position.y, box.min.z);
      found = true;
    }
    const maxZDistance = Math.abs(position.z - box.max.z);
    if (maxZDistance < closestDistance) {
      closestDistance = maxZDistance;
      nearestWallResult.normal.set(0, 0, 1);
      nearestWallResult.point.set(position.x, position.y, box.max.z);
      found = true;
    }
  }
  if (!found) return null;
  nearestWallResult.distance = closestDistance;
  return nearestWallResult;
}
