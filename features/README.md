# Portfolio feature map

`features.json` is the executable inventory. `npm run live` first proves its record IDs still equal `content/portfolio-content.json`, its route list still serves, and every named control still has its implementation marker. It then opens the mapped browser routes and every record route in Chromium.

The mapped records are Bradley; INFAMOUS PR; Music Promotions; Systems & AI Consulting; Product Studio; Campaign Kickoff, Pitching and Reporting; Real-Estate Deal Tracker; Tour Advancing; Dubs; Writ; Making Work Playable; and Philosophy. Each is reached from the world map or contents and proved by `/index/<id>` rendering its content label plus a clean browser load.

The mapped controls cover world and contents selection, resizable reading-room panels, carousel links, toolbar actions, the Guide and retry path, analytics preference, the touring form/views/reset, and the quarterly dashboard’s period, filters, detail, CSV and print actions. The existing live interactions exercise resizing, carousel feedback and toolbar geometry; source markers and component tests cover controls whose use would write, download, print or send chat.

The mapped standalone routes are Tour Advancing, Quarterly Dashboard, Privacy and robots.txt. The check also verifies the home page, www, sitemap, PDF CV, 404, chat-session configuration and the Access-gated insights surface.

Update both map files with any route, record or control change. `npm run live -- --map-only` distinguishes stale inventory from a browser, credential or production failure.
