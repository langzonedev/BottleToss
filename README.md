# BottleToss

BottleToss is a Lang Systems browser arcade game set on the fictional Sunset Circuit. Ride in the back seat, lean through the open window and time a bottle throw as a roadside sign sweeps past.

[Play on GitHub Pages](https://langzonedev.github.io/BottleToss/)

## Controls

| Input | Lean | Aim | Throw |
| --- | --- | --- | --- |
| Touch | Hold the amber button or game view | Drag from where you pressed | Lift your finger |
| Mouse | Hold the primary button over the game | Drag from where you clicked | Release |
| Keyboard | Hold Space | Arrow keys or WASD | Release Space |

Wait for **Release now** and the green sight. The little diamond marks the target’s aim point. On keyboard, hold a direction to nudge the sight. Pause with Escape or the Pause button. The run also pauses when the browser loses focus.

- **Start run** gives you 60 seconds and 18 bottles. Direction signs score 100, warnings 200 and speed limits 350. A centred, well-timed hit adds 50 before the streak multiplier. Consecutive hits unlock up to ×4.
- **Practice** gives you unlimited time and bottles with a wider hit window. Its score is separate from your local best.
- Sound and the scored-run best are stored in this browser. The game uses locally generated graphics and audio.

## Hosting and development

Publish from **Settings → Pages → Deploy from a branch → main → /(root)**. There is no build step. Serve the repository root over HTTP for local development, for example with `python3 -m http.server 8000`.

[Lang Systems Core baseline](docs/CORE_BASELINE.md) · [Human test handoff](docs/PLAYTEST.md)

## First playtest candidate

Verified in desktop Chromium and in 390 × 844 portrait and 844 × 390 landscape viewports. Scripted checks exercised hit and miss scoring, pause and resume, run results, replay and local best. The first human pass should focus on touch aim and impact sound on a physical phone.
