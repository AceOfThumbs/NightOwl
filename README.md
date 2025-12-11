# NightOwl

NightOwl is a static circadian rhythm planner built with plain HTML, CSS, and JavaScript. The `gh-pages` branch hosts the production build so it can be served directly from GitHub Pages without any additional tooling.

## Features

- Circular clock with hour numerals for quick spatial orientation of your day.
- Drag-and-drop editing of schedule segments with desktop and touch support.
- "Your Day" list view that mirrors the clock so you can fine-tune start and end times with accessible controls.
- Light and dark themes that automatically adapt to the visitor's preference.

## Usage

Open `index.html` in any modern browser to interact with the planner. Schedule segments can be adjusted in two complementary ways:

1. **Clock interactions** – Drag the handles on the circular dial to resize or reposition an event. On touch devices, the page will no longer scroll while you are dragging a handle.
2. **Your Day list** – Use the time controls beside each event to edit start and end times in 15-minute increments. These controls now display consistently on both desktop and mobile viewports.

Changes are stored in `localStorage`, so your latest plan remains the next time you visit the page in the same browser.

## Development

This is a static site with no build tooling. To preview changes locally, open `index.html` directly from the filesystem or serve the repository with any static file server.
