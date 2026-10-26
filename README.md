# CLASSIFIED

A first-person retro 3D horror experience for the browser. Collect seven notebooks, answer the questions, avoid the teacher, and leave.

Built with HTML, CSS, vanilla JavaScript, Three.js r160 (pinned, loaded from the jsDelivr CDN through an import map in `index.html`) and the Web Audio API. All textures, models and sounds are generated procedurally. The CDN means the page needs an internet connection to load Three.js.

## Controls
WASD move · Shift sprint · Mouse look · E interact · 1–3 use item · Esc pause

## Run locally
ES modules need a web server (not `file://`):

    python3 -m http.server 8000

Open http://localhost:8000

## Deploy to GitHub Pages
1. Create a new repository on GitHub (public).
2. Upload every file in this folder, keeping the `scripts/` folder structure (`git push` or drag and drop in the web UI).
3. Open the repository, then Settings → Pages. Under "Build and deployment", choose "Deploy from a branch", select `main` and `/ (root)`, then Save.
4. Wait a minute, then open `https://<your-username>.github.io/<repository-name>/`.

All paths are relative, so no further configuration is needed. This README does not claim a deployment exists; you create it.

## Layout
- `scripts/world.js` — map table, zones, geometry, collision, doors, pickups, pathfinding. Edit `NOTEBOOK_SPOTS` and `ITEM_SPOTS` to move things.
- `scripts/actors.js` — teacher state machine plus monitor, runner, janitor.
- `scripts/main.js` — player, controls, interface, session flow.
- `scripts/questions.js`, `audio.js`, `settings.js` — questions, procedural sound, saved preferences.
