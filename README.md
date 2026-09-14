# SlingVR

SlingVR is a compact WebXR traversal playground inspired by superhero swinging games: shoot two physical-feeling web lines, swing between a procedural city, zip to rooftops, wall-run, and chain air tricks from either desktop or VR.

**[Play the live demo](https://communitypokeorg.github.io/SlingVR/)**

## Features

- Fixed-timestep custom rope physics with reel-in, spring tension, momentum, and a simplified single-corner tether wrap.
- Seeded low-poly city with instanced buildings, rooftop perch targets, analytic ray/AABB collision, and a readable HUD.
- Web zip and point launch, wall running, air dash, style scoring, and desktop or WebXR controller input.
- Vite + Three.js + TypeScript build that deploys to GitHub Pages.

## Control modes

SlingVR opens in **Friendly Neighborhood** mode for assisted, comfortable traversal. Switch to **Spectacular** from the start overlay, with `M` on desktop, or by clicking the left thumbstick in XR.

| Feature | Friendly Neighborhood | Spectacular VR | Spectacular desktop |
| --- | --- | --- | --- |
| Turning | Head plus smooth right-stick turn | Head-only turning | Mouse look |
| Web swing | Trigger/held mouse buttons reel and add swing assistance | Physical hand pulls reel and build momentum | `W` while attached stands in for the arm pull |
| Web zip | Guided immediate zip | Pull back while gripping to charge, then release | Hold `E` or middle mouse to charge |
| Wall run | Right stick vertical input | Left stick steers and runs near a wall | `WASD` plus Shift |
| Jump off wall | A/X or Space | A/X or Space | Space |
| Air dash | B/Y or Shift | Physical forward punch | Shift fallback |

## Controls

| Action | Desktop | VR |
| --- | --- | --- |
| Look / steer | Mouse + WASD | Head + thumbstick (mode-dependent) |
| Shoot web | LMB / RMB (hold) | Controller trigger (hold) |
| Jump / release / wall jump-off | Space | A / X |
| Zip / point launch | E or middle mouse | Controller grip |
| Wall run / dash | Hold Shift / tap Shift | Thumbsticks + jump or physical punch |
| Toggle mode / reset / help / debug | M / R / H / F | Left-stick click / — |

### XR controls

| Input | Action |
| --- | --- |
| Left/right trigger | Shoot and hold the corresponding web |
| Left/right grip | Zip toward that controller's ray |
| Left stick | Friendly: steer; Spectacular: steer and wall-run |
| Right stick | Friendly: Y wall-run, X smooth turn; Spectacular: unused |
| A/X | Jump when grounded, release webs while airborne |
| B/Y | Friendly air dash along head-forward |
| Punch | Spectacular air dash when a forward hand punch is detected |
| Left-stick click | Toggle Friendly Neighborhood / Spectacular |

## Local development

```bash
npm i
npm run dev
npm run build
npm run preview
```

The Vite base path is `/SlingVR/` for Pages. For local preview, open `http://localhost:4173/SlingVR/`.

## Deploy

Pushes to `main` run the GitHub Actions Pages workflow. In repository Settings → Pages, choose **GitHub Actions** as the source.

## Architecture

| Area | Files |
| --- | --- |
| Bootstrap | `src/main.ts`, `src/state.ts`, `src/Player.ts` |
| City | `src/city/CityGenerator.ts` |
| Physics | `src/physics/PlayerBody.ts`, `Web.ts`, `Zip.ts`, `WallRun.ts`, `AirTricks.ts`, `collision.ts` |
| Input | `src/input/DesktopInput.ts`, `XRInput.ts` (thin adapters over the shared `Player`) |
| Rendering/UI | `src/render/*`, `src/ui/Hud.ts`, `index.html` |
| Tests | `src/physics/__tests__/rope.test.ts` |

## Limitations and future work

This is a deliberately small prototype: it uses custom physics rather than a physics engine, box-only city geometry, no hand tracking, audio, animation/IK, or MSM2 assets, and performance has not been tuned on a standalone Quest. VR play should use a comfort vignette in a future pass; this prototype intentionally keeps the camera free of a vignette. Future experiments could add corner unwrap/multi-segment ropes, loop-de-loops, web wings, better comfort options, richer city materials, and haptics.

The XR adapter treats `renderer.xr.getController(0)` as the left controller and index `1` as the right controller. Three.js/WebXR does not guarantee that index-to-handedness mapping across runtimes; this prototype uses the fixed convention for its trigger and grip bindings. Spectacular's punch and pull detection are heuristics based on controller pose deltas, not hand tracking. It intentionally has no turn assistance, so standing players should turn physically; no hand tracking is available.

## License

MIT. See [LICENSE](LICENSE). Copyright © CommunityPoke contributors.
WebXR / web-based swinging prototype with procedural Three.js city and physics-based traversal mechanics.
