import type { Web } from '../physics/Web';
import type { PlayerBody } from '../physics/PlayerBody';
import type { AirTricks } from '../physics/AirTricks';
import type { WallRun } from '../physics/WallRun';
import type { Zip } from '../physics/Zip';
import type { TravelState } from '../state';

export class Hud {
  private readonly root: HTMLElement;
  private readonly debug: HTMLElement;
  private readonly help: HTMLElement;
  private lastFrame = performance.now();
  private frames = 0;
  private fps = 60;

  constructor() {
    this.root = document.querySelector<HTMLElement>('#hud') ?? document.body;
    this.debug = document.createElement('div');
    this.debug.className = 'debug';
    this.help = document.createElement('div');
    this.help.className = 'help-panel hidden';
    this.help.innerHTML = '<strong>CONTROLS</strong><br>WASD steer · Mouse look · LMB/RMB web swing<br>Space jump/release · E zip · Shift wall-run/dash<br>R reset · H help · F debug<br><br><strong>VR</strong><br>Triggers shoot webs · Grip zips · Thumbstick steers · A/X jumps';
    this.root.append(this.help, this.debug);
  }

  toggleHelp(): void {
    this.help.classList.toggle('hidden');
  }

  update(
    player: PlayerBody,
    state: TravelState,
    tricks: AirTricks,
    left: Web,
    right: Web,
    zip: Zip,
    wallRun: WallRun,
  ): void {
    this.frames += 1;
    const now = performance.now();
    if (now - this.lastFrame > 500) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastFrame));
      this.frames = 0;
      this.lastFrame = now;
    }
    const speed = player.velocity.length() * 3.6;
    this.root.innerHTML = `<div class="stats"><span class="brand">SLING<span>VR</span></span><span>${speed.toFixed(0)} km/h</span><span>${player.position.y.toFixed(0)} m ALT</span><span class="state">${state}</span><span>STYLE ${tricks.style}</span>${tricks.lastTrick ? `<b>${tricks.lastTrick}</b>` : ''}<span>${this.fps} FPS</span></div>`;
    this.root.append(this.help, this.debug);
    if (!this.debug.classList.contains('hidden')) {
      this.debug.textContent = `L ${left.restLength.toFixed(1)}m / ${left.tension.toFixed(0)}N · R ${right.restLength.toFixed(1)}m / ${right.tension.toFixed(0)}N\n${zip.active ? 'ZIP TARGET LOCKED' : ''} ${wallRun.active ? `WALL RUN ${player.wallNormal.x.toFixed(1)},${player.wallNormal.z.toFixed(1)}` : ''}`;
    }
  }

  toggleDebug(): void {
    this.debug.classList.toggle('hidden');
  }
}
