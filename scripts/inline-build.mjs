// Inlines dist/ into one self-contained HTML page (used to publish a playable preview anywhere).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const js = readFileSync('dist/assets/app.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync('dist/assets/index.css', 'utf8');
const html = `<title>Tatami Twin</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap">
<style>${css}</style>
<div id="app"></div>
<script type="module">${js}</script>
`;
mkdirSync('single', { recursive: true });
writeFileSync('single/tatami-twin.html', html);
console.log(`single/tatami-twin.html ${(html.length / 1024).toFixed(0)} kB`);
