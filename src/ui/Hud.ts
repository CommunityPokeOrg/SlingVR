import type { Web } from '../physics/Web';
import type { PlayerBody } from '../physics/PlayerBody';
import type { AirTricks } from '../physics/AirTricks';
import type { WallRun } from '../physics/WallRun';
import type { Zip } from '../physics/Zip';
import type { ControlMode } from '../settings';
import { SETTINGS } from '../settings';
import type { TravelState } from '../state';

export class Hud {
  private readonly root: HTMLElement;
  private readonly debug: HTMLElement;
  private readonly help: HTMLElement;
  private lastFrame = performance.now();
  private frames = 0;
  private fps = 60;
  private mode: ControlMode = SETTINGS.mode;
  private readonly toast: HTMLElement;

  constructor() {
    this.root = document.querySelector<HTMLElement>('#hud') ?? document.body;
    this.debug = document.createElement('div');
    this.debug.className = 'debug';
    this.help = document.createElement('div');
    this.help.className = 'help-panel hidden';
    this.toast = document.createElement('div');
    this.toast.className = 'mode-toast hidden';
    this.renderHelp();
    this.root.append(this.help, this.debug, this.toast);
    window.addEventListener('slingvr:mode', this.onMode);
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
    mode: ControlMode,
    charge: number,
    charging: boolean,
    punchSpeed: number,
    leftReel: number,
    rightReel: number,
  ): void {
    this.frames += 1;
    const now = performance.now();
    if (now - this.lastFrame > 500) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastFrame));
      this.frames = 0;
      this.lastFrame = now;
    }
    const speed = player.velocity.length() * 3.6;
    this.mode = mode;
    const chargeLabel = charging ? `<span>ZIP ${Math.round(charge * 100)}%</span>` : '';
    this.root.innerHTML = `<div class="stats"><span class="brand">SLING<span>VR</span></span><span class="mode-badge ${mode}">MODE: ${mode === 'friendly' ? 'FRIENDLY NEIGHBORHOOD' : 'SPECTACULAR'}</span><span>${speed.toFixed(0)} km/h</span><span>${player.position.y.toFixed(0)} m ALT</span><span class="state">${state}</span>${chargeLabel}<span>STYLE ${tricks.style}</span>${tricks.lastTrick ? `<b>${tricks.lastTrick}</b>` : ''}<span>${this.fps} FPS</span></div>`;
    this.root.append(this.help, this.debug, this.toast);
    if (!this.debug.classList.contains('hidden')) {
      this.debug.textContent = `L ${left.restLength.toFixed(1)}m / ${left.tension.toFixed(0)}N · R ${right.restLength.toFixed(1)}m / ${right.tension.toFixed(0)}N\nREEL ${leftReel.toFixed(3)}m / ${rightReel.toFixed(3)}m · PUNCH ${punchSpeed.toFixed(2)}m/s\n${zip.active ? 'ZIP TARGET LOCKED' : ''} ${wallRun.active ? `WALL RUN ${player.wallNormal.x.toFixed(1)},${player.wallNormal.z.toFixed(1)}` : ''}`;
    }
  }

  toggleDebug(): void {
    this.debug.classList.toggle('hidden');
  }

  private readonly onMode = (event: Event): void => {
    const mode = (event as CustomEvent<ControlMode>).detail;
    this.mode = mode;
    this.renderHelp();
    this.toast.textContent = `Switched to ${mode === 'friendly' ? 'Friendly Neighborhood' : 'Spectacular'}`;
    this.toast.classList.remove('hidden');
    window.setTimeout(() => this.toast.classList.add('hidden'), 2000);
  };

  private renderHelp(): void {
    const friendly = this.mode === 'friendly';
    this.help.innerHTML = `<strong>${friendly ? 'FRIENDLY NEIGHBORHOOD' : 'SPECTACULAR'} CONTROLS</strong><br>${friendly ? 'WASD steer · Mouse look · LMB/RMB reel webs' : 'WASD steer · Mouse look · W while attached pumps webs'}<br>Space jump/release · ${friendly ? 'E zip' : 'Hold E'} · Shift wall-run/dash<br>${friendly ? 'M toggle mode' : 'M toggle mode · E/MMB hold charged zip'} · R reset · H help · F debug<br><br><strong>VR</strong><br>Triggers shoot webs · Grip ${friendly ? 'zips' : 'charges zip'} · ${friendly ? 'Left stick steers · right stick wall-runs/turns' : 'left stick steers and wall-runs · head turns'}<br>A/X jump · ${friendly ? 'B/Y air dash' : 'physical punch air dash'} · Left stick click toggles mode`;
  }
}
