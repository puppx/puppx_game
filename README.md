# Puppx Rampage

A tiny pixel-art arena survival game. Made for phones first, built with plain HTML, CSS and JavaScript (no libraries, no build step). Once it's loaded, it plays offline.

## How to play

- **Move:** drag anywhere on the screen (a joystick appears under your thumb). On a keyboard, use WASD or the arrow keys.
- **Shoot:** automatic. You always fire at the nearest enemy.
- **Dash:** tap the **DASH** button (or press Space/Shift). You can't be hurt while dashing, so use it to slip through bullets.
- **Level up:** pick up gems to level up and choose 1 of 3 upgrades. Gold cards are **RARE** and count as two levels.
- **Combo:** chain kills without getting hit. Every 30+ combo triggers **FEVER MODE** (double fire rate, rainbow bullets).
- **Waves:** each wave lasts 25 seconds and can bring a random twist (Bat Swarm, Gold Rush, Bomb Party, Giants...).
- **Bosses** arrive every 5 waves. Beat one to unlock a new zone: Meadow → Dungeon → Lava Lands → Ice Caves → The Void.
- **Chests** show up around the map (follow the arrow at the edge of the screen). Each one gives a free upgrade.
- **Coins** carry over between runs. Spend them in the **Shop** on permanent upgrades, or unlock the Cat, Frog and Bun.

## Play offline / install like an app

The game is a Progressive Web App. It needs to be served over HTTPS once (GitHub Pages works); after that it's cached on your phone.

1. Open the game URL on your phone.
2. **iPhone (Safari):** Share → *Add to Home Screen*.
   **Android (Chrome):** menu ⋮ → *Install app* / *Add to Home screen*.
3. Launch it from the home screen icon. It runs fullscreen, works in airplane mode, and keeps your progress on the device.

### Hosting on GitHub Pages

Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick `main` and `/ (root)`, then save.
After a minute the game is live at `https://<your-username>.github.io/puppx_game/`.

## Run locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` straight from disk also works, but offline caching needs a server.)

## Project layout

| File | What it does |
| --- | --- |
| `index.html` | Page shell and service worker registration |
| `style.css` | Fullscreen, crisp pixel scaling, no scroll/zoom on mobile |
| `js/font.js` | Built-in 5px bitmap font |
| `js/art.js` | All pixel-art sprites and icons, drawn from text grids |
| `js/sfx.js` | Synthesised chiptune sound effects and music (Web Audio) |
| `js/game.js` | Game loop, enemies, weapons, upgrades, menus, shop, saving |
| `sw.js` | Offline cache |
| `manifest.webmanifest` | Install-as-app metadata |

When you change game files, bump `CACHE` in `sw.js` (e.g. `puppx-rampage-v2`) so installed copies pick up the update.
