import * as THREE from 'three';
import type { AABB } from '../physics/collision';

export interface CityData {
  buildings: AABB[];
  perches: THREE.Vector3[];
  spawn: THREE.Vector3;
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export class CityGenerator {
  readonly group = new THREE.Group();
  readonly data: CityData = { buildings: [], perches: [], spawn: new THREE.Vector3(0, 8, 12) };
  private readonly buildingMesh: THREE.InstancedMesh;
  private readonly perchMesh: THREE.InstancedMesh;

  constructor(seed = 1337) {
    const random = mulberry32(seed);
    const blockCount = 12;
    const blockSize = 40;
    const street = 14;
    const total = blockCount * blockSize;
    const buildingCount = blockCount * blockCount * 4;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const palette = ['#8ea3b8', '#a8b6c4', '#b58a6e', '#6f8fa3', '#c7c2b0', '#7f95b0'];
    const windowTexture = this.createBuildingTexture();
    const vertexCount = geometry.getAttribute('position').count;
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(vertexCount * 3).fill(1), 3));
    this.buildingMesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshLambertMaterial({ map: windowTexture, vertexColors: true, flatShading: true }),
      buildingCount,
    );
    this.buildingMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const matrix = new THREE.Matrix4();
    let instance = 0;
    for (let row = 0; row < blockCount; row += 1) {
      for (let column = 0; column < blockCount; column += 1) {
        const centerX = (column - blockCount / 2 + 0.5) * blockSize;
        const centerZ = (row - blockCount / 2 + 0.5) * blockSize;
        const buildingsInBlock = 1 + Math.floor(random() * 4);
        for (let building = 0; building < buildingsInBlock && instance < buildingCount; building += 1) {
          const width = 8 + random() * Math.max(8, blockSize - street - 12);
          const depth = 8 + random() * Math.max(8, blockSize - street - 12);
          const offsetX = (random() - 0.5) * (blockSize - street - width);
          const offsetZ = (random() - 0.5) * (blockSize - street - depth);
          const centerBias = 1 - Math.hypot(column - 5.5, row - 5.5) / 8;
          const height = 20 + random() * 85 + Math.max(0, centerBias) * 53;
          const x = centerX + offsetX;
          const z = centerZ + offsetZ;
          matrix.compose(new THREE.Vector3(x, height / 2, z), new THREE.Quaternion(), new THREE.Vector3(width, height, depth));
          this.buildingMesh.setMatrixAt(instance, matrix);
          const color = new THREE.Color(palette[Math.floor(random() * palette.length)] ?? palette[0]);
          color.multiplyScalar(0.78 + random() * 0.24);
          this.buildingMesh.setColorAt(instance, color);
          const min = new THREE.Vector3(x - width / 2, 0, z - depth / 2);
          const max = new THREE.Vector3(x + width / 2, height, z + depth / 2);
          this.data.buildings.push({ min, max });
          if (random() < 0.3) this.data.perches.push(new THREE.Vector3(x, height + 1.1, z));
          instance += 1;
        }
      }
    }
    this.buildingMesh.count = instance;
    this.buildingMesh.instanceColor?.setUsage(THREE.StaticDrawUsage);
    this.group.add(this.buildingMesh);

    const perchGeometry = new THREE.BoxGeometry(1.4, 3.2, 1.4);
    this.perchMesh = new THREE.InstancedMesh(
      perchGeometry,
      new THREE.MeshBasicMaterial({ color: '#4ff2ff', toneMapped: false }),
      this.data.perches.length,
    );
    for (let index = 0; index < this.data.perches.length; index += 1) {
      const perch = this.data.perches[index];
      if (perch) {
        matrix.makeTranslation(perch.x, perch.y, perch.z);
        this.perchMesh.setMatrixAt(index, matrix);
      }
    }
    this.group.add(this.perchMesh);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(total + 80, total + 80),
      new THREE.MeshLambertMaterial({ color: '#2c3038' }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.group.add(ground);

    const padMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: '#5c6068' }),
      blockCount * blockCount,
    );
    let padIndex = 0;
    for (let row = 0; row < blockCount; row += 1) {
      for (let column = 0; column < blockCount; column += 1) {
        const centerX = (column - blockCount / 2 + 0.5) * blockSize;
        const centerZ = (row - blockCount / 2 + 0.5) * blockSize;
        matrix.compose(new THREE.Vector3(centerX, 0.05, centerZ), new THREE.Quaternion(), new THREE.Vector3(blockSize - street, 0.1, blockSize - street));
        padMesh.setMatrixAt(padIndex, matrix);
        padIndex += 1;
      }
    }
    this.group.add(padMesh);

    const streetMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: '#a9adb2' }),
      (blockCount + 1) * 2,
    );
    const streetRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    let streetIndex = 0;
    for (let index = 0; index <= blockCount; index += 1) {
      const edge = (index - blockCount / 2) * blockSize;
      matrix.compose(new THREE.Vector3(0, 0.025, edge), streetRotation, new THREE.Vector3(total + street, 0.3, 1));
      streetMesh.setMatrixAt(streetIndex, matrix);
      streetIndex += 1;
      matrix.compose(new THREE.Vector3(edge, 0.026, 0), streetRotation, new THREE.Vector3(0.3, total + street, 1));
      streetMesh.setMatrixAt(streetIndex, matrix);
      streetIndex += 1;
    }
    this.group.add(streetMesh);

    let fallbackDistance = Number.POSITIVE_INFINITY;
    for (const building of this.data.buildings) {
      const centerX = (building.min.x + building.max.x) * 0.5;
      const centerZ = (building.min.z + building.max.z) * 0.5;
      const distance = Math.hypot(centerX, centerZ);
      const height = building.max.y;
      if (distance <= 60 && height >= 40 && height <= 70) {
        this.data.spawn.set(centerX, height + 1, centerZ);
        break;
      }
      if (distance < fallbackDistance) {
        fallbackDistance = distance;
        this.data.spawn.set(centerX, height + 1, centerZ);
      }
    }
  }

  get renderableBuildings(): THREE.InstancedMesh {
    return this.buildingMesh;
  }

  private createBuildingTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create building texture');
    context.fillStyle = '#f4f5f2';
    context.fillRect(0, 0, 128, 128);
    for (let x = 4; x < 128; x += 16) {
      context.fillStyle = x % 32 === 4 ? '#dce4e8' : '#ffffff';
      context.fillRect(x, 0, 6, 128);
      for (let y = 8; y < 128; y += 16) {
        context.fillStyle = (x + y) % 48 === 0 ? '#ffe2a0' : '#7c96a6';
        context.fillRect(x, y, 5, 7);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    texture.anisotropy = 2;
    return texture;
  }
}
