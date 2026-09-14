import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildingLedges, findDualLedge, findLedge } from '../Ledge';
import { Zip } from '../Zip';
import { WebZip } from '../WebZip';
import { PlayerBody } from '../PlayerBody';
import { GAME } from '../../state';

const roof = { min: new THREE.Vector3(-10, 0, -30), max: new THREE.Vector3(10, 20, -10) };
const buildings = [roof];
const origin = new THREE.Vector3(0, 10, 10);
const toward = (point: THREE.Vector3, from = origin): THREE.Vector3 => point.clone().sub(from).normalize();
const city = { buildings, perches: [], spawn: origin };

describe('continuous rooftop ledges', () => {
  it.each([-7, -2, 0, 3, 8])('targets any position along an edge at x=%s', (x) => {
    const point = new THREE.Vector3(x, 20, -10);
    const target = findLedge(origin, toward(point), buildings);
    expect(target?.point.distanceTo(point)).toBeLessThan(1e-5);
    expect(target?.ledge.normal.toArray()).toEqual([0, 0, 1]);
  });

  it('snaps nearby aim without changing the input ray', () => {
    const direction = toward(new THREE.Vector3(3, 19, -10));
    const before = direction.clone();
    const target = findLedge(origin, direction, buildings);
    expect(target?.point.y).toBe(20);
    expect(direction.equals(before)).toBe(true);
  });

  it('does not target wall centers, roof centers, hidden edges, or distant edges', () => {
    expect(findLedge(origin, toward(new THREE.Vector3(0, 10, -10)), buildings)).toBeNull();
    const above = new THREE.Vector3(0, 40, -20);
    expect(findLedge(above, new THREE.Vector3(0, -1, 0), buildings)).toBeNull();
    const blocker = { min: new THREE.Vector3(-15, 0, -5), max: new THREE.Vector3(15, 35, 0) };
    expect(findLedge(origin, toward(new THREE.Vector3(0, 20, -10)), [roof, blocker])).toBeNull();
    const distant = new THREE.Vector3(0, 20, 40);
    expect(findLedge(distant, new THREE.Vector3(0, 0, -1), buildings)).toBeNull();
  });

  it('requires both controller rays to converge on the same ledge', () => {
    const left = origin.clone().add(new THREE.Vector3(-0.3, 0, 0));
    const right = origin.clone().add(new THREE.Vector3(0.3, 0, 0));
    const point = new THREE.Vector3(2, 20, -10);
    const target = findDualLedge(left, toward(point, left), right, toward(point, right), buildings);
    expect(target?.point.distanceTo(point)).toBeLessThan(1e-5);
    expect(findDualLedge(left, toward(point, left), right, new THREE.Vector3(0, -1, 0), buildings)).toBeNull();
    expect(findDualLedge(left, toward(new THREE.Vector3(-7, 20, -10), left), right, toward(point, right), buildings)).toBeNull();
  });

  it('rejects opposite edges even when their target points are close', () => {
    const small = [{ min: new THREE.Vector3(-1, 0, -1), max: new THREE.Vector3(1, 10, 1) }];
    const left = new THREE.Vector3(-5, 12, 0);
    const right = new THREE.Vector3(5, 12, 0);
    expect(findDualLedge(left, toward(new THREE.Vector3(-1, 10, 0), left), right, toward(new THREE.Vector3(1, 10, 0), right), small)).toBeNull();
    expect(buildingLedges(small)).toHaveLength(4);
  });

  it('falls back to a surface for web zip when no ledge is near the aim', () => {
    const zip = new Zip();
    const target = zip.aim(origin, new THREE.Vector3(0, 0, -1), city);
    expect(target?.kind).toBe('surface');
    const saved = target?.point.clone();
    zip.aim(origin, toward(new THREE.Vector3(5, 15, -10)), city);
    expect(target?.point.equals(saved!)).toBe(true);
  });
});

describe('zip traversal', () => {
  it('clears the lip and lands with the hitbox supported on the roof', () => {
    const body = new PlayerBody(origin);
    const zip = new Zip();
    const target = zip.aim(origin, toward(new THREE.Vector3(3, 20, -10)), city);
    expect(target?.kind).toBe('perch');
    expect(zip.launch(target!, body)).toBe(true);
    let mounted = false;
    for (let i = 0; i < 300 && zip.active; i += 1) mounted = zip.step(GAME.fixedStep, body, buildings);
    expect(mounted).toBe(true);
    expect(body.position.y).toBeCloseTo(20 + GAME.playerRadius);
    expect(body.position.z).toBeLessThan(-10);
    for (let i = 0; i < 120; i += 1) body.step(GAME.fixedStep, buildings);
    expect(body.grounded).toBe(true);
    expect(body.position.y).toBeCloseTo(20 + GAME.playerRadius);
  });

  it('stops at an intervening building instead of moving through it', () => {
    const body = new PlayerBody(origin);
    const zip = new Zip();
    const target = zip.aim(origin, toward(new THREE.Vector3(0, 20, -10)), city);
    zip.launch(target!, body);
    const blocker = { min: new THREE.Vector3(-5, 0, -2), max: new THREE.Vector3(5, 40, 0) };
    let mounted = false;
    for (let i = 0; i < 300 && zip.active; i += 1) mounted = zip.step(GAME.fixedStep, body, [roof, blocker]);
    expect(mounted).toBe(false);
    expect(zip.active).toBe(false);
    expect(body.position.z).toBeGreaterThanOrEqual(GAME.playerRadius);
  });

  it('Friendly web zip covers a longer distance while keeping ground contact', () => {
    const body = new PlayerBody(new THREE.Vector3(0, GAME.playerRadius, 0));
    body.grounded = true;
    const zip = new WebZip();
    zip.shoot(body.position, new THREE.Vector3(0, GAME.playerRadius, -60));
    for (let i = 0; i < 240 && zip.active; i += 1) {
      zip.step(GAME.fixedStep, body, []);
      body.step(GAME.fixedStep, [], zip.force);
    }
    expect(body.position.z).toBeLessThan(-30);
    expect(body.grounded).toBe(true);
    expect(zip.active).toBe(false);
    expect(zip.cooldown).toBeGreaterThan(0);
  });
});
