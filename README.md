# AvaPlay for Samsung Tizen TV

An IPTV player for Samsung Smart TVs (Tizen web app): Live TV, Movies and TV Shows from an Xtream login or an M3U link, with first-time setup, favourites, hidden groups, continue watching, subtitles and episode playback. It follows the design and behaviour of the AvaPlay Android TV app, which is not part of this repository.

**Status:** tested in a desktop browser and against a simulated Samsung player only. It has **not** been run on a real Samsung TV yet.

## Run in a browser (development)

```
npm install
npm run dev        # http://127.0.0.1:3000
```

The browser cannot call IPTV providers directly (CORS) or play MPEG-TS, so the dev server (`vite.config.js`) includes a local proxy, and HLS plays through `hls.js`. Both exist for browser testing only. On the TV the app talks to the provider directly and plays through the Samsung player (AVPlay). Press **R** to hide the virtual remote.

## Build

```
npm run build      # dist/
npm run package    # builds/AvaPlay-1.0.0.wgt (an unsigned zip)
```

The `.wgt` is **not signed**. To install on a TV, build and sign it with Tizen Studio (Developer Mode on the TV, a Samsung certificate profile).

## Layout

- `src/index.js` — Live TV, player overlays, channel browser
- `src/ui/` — Movies and TV Shows (`MoviesView`, `SeriesPage`), film player (`VodPlayer`), Settings, first-time setup
- `src/data/` — Xtream and M3U loading, settings, storage, country and group detection
- `src/player/TizenAVPlayer.js` — Samsung AVPlay wrapper with an HTML5 fallback for the browser
- `public/flags/` — country flags from [flag-icons](https://github.com/lipis/flag-icons) (MIT)

## Known gaps and risks (to check on a TV)

- The app ID `AvaPlayTizen` is 12 characters; Tizen needs a 10-character package ID. Regenerate `config.xml` from a Tizen Studio TV project.
- The build loads its script as `type="module"`, which has failed on TVs for other Vite apps; a non-module build may be needed.
- Extra remote keys (CH+/CH-, play/pause, colour keys) are not registered with `tizen.tvinputdevice.registerKey`.
- Fonts load from Google Fonts; they should be bundled.
- Large film and show lists are parsed in one piece and may be heavy on low-memory TVs.
- The CSS uses flex `gap`, `inset` and `:has()`: TVs from 2023 (Tizen 7.0, Chromium 94) and newer are the target; 2020–2022 models need CSS changes.
- Not built: TV guide (EPG), phone entry by QR code (a TV web app cannot listen for connections), sound-delay calibration.

Samsung's table of Tizen and Chromium versions by model year: https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html
