import * as THREE from 'three';
import type { AABB } from '../physics/collision';

export interface CityData {
  buildings: AABB[];
  perches: THREE.Vector3[];
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
  readonly data: CityData = { buildings: [], perches: [] };
  private readonly buildingMesh: THREE.InstancedMesh;
  private readonly perchMesh: THREE.InstancedMesh;

  constructor(seed = 1337) {
    const random = mulberry32(seed);
    const blockCount = 12;
    const blockSize = 40;
    const street = 14;
    const total = blockCount * blockSize;
    const buildingCount = blockCount * blockCount * 2;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const palette = ['#38506a', '#526b86', '#725d70', '#3b6270', '#5d6678'];
    this.buildingMesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
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
          const height = 20 + random() * 85 + Math.max(0, centerBias) * 55;
          const x = centerX + offsetX;
          const z = centerZ + offsetZ;
          matrix.compose(new THREE.Vector3(x, height / 2, z), new THREE.Quaternion(), new THREE.Vector3(width, height, depth));
          this.buildingMesh.setMatrixAt(instance, matrix);
          this.buildingMesh.setColorAt(instance, new THREE.Color(palette[Math.floor(random() * palette.length)] ?? palette[0]));
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

    const perchGeometry = new THREE.BoxGeometry(0.8, 2.2, 0.8);
    this.perchMesh = new THREE.InstancedMesh(
      perchGeometry,
      new THREE.MeshBasicMaterial({ color: '#61e5ff', toneMapped: false }),
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
      new THREE.MeshLambertMaterial({ color: '#111923' }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.group.add(ground);
    const grid = new THREE.GridHelper(total, blockCount * 2, '#324759', '#1a2a39');
    grid.position.y = 0.02;
    this.group.add(grid);
  }

  get renderableBuildings(): THREE.InstancedMesh {
    return this.buildingMesh;
  }
}
