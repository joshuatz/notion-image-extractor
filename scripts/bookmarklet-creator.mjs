/**
 * @file Adapted from my own code: https://github.com/joshuatz/music-meta-dom-scraper/blob/fa9458844a3ca48a33bc6002d34ae9d382f08c67/bookmarklet-creator.js
 * (I really should extract this into a util...)
 */
// @ts-check

import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import bookmarkleter from 'bookmarkleter';
import packageInfo from '../package.json' assert { type: 'json' };

const bookmarkletTitle = 'Notion Image Extractor';
const __dirname = dirname(fileURLToPath(import.meta.url));
const rawCode = fs.readFileSync(path.join(__dirname, '..', 'index.mjs'));
const windowGlobalAccessor = 'window.notionImageExtractor';

const buildTimeStampMs = new Date().getTime();
const version = packageInfo.version;

const buildHtmlInstallLink = (invocationCode = '', title = bookmarkletTitle) => {
	const finalRuntimeCode = rawCode + `\nconsole.log('${bookmarkletTitle} - v${version}');\n` + invocationCode;
	const bookmarkletString = bookmarkleter(finalRuntimeCode, { minify: true, iife: true })?.replace(/\n|\t/g, '');
	return `<a class="bookmarklet" href="${bookmarkletString}">${title}</a>`;
};

const distDir = path.join(__dirname, '..', 'dist');
const pageHTML = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${bookmarkletTitle} - Install Page</title>
	<style>
		#main {
			text-align: center;
		}
		.bookmarklet {
			box-shadow:inset 0px 0px 15px 3px #23395e;
			background:linear-gradient(to bottom, #2e466e 5%, #415989 100%);
			background-color:#2e466e;
			border-radius:17px;
			border:1px solid #1f2f47;
			display:inline-block;
			cursor:pointer;
			color:#ffffff;
			font-family:Arial;
			font-size:15px;
			padding:6px 13px;
			text-decoration:none;
			text-shadow:0px 1px 0px #263666;
		}
	</style>
</head>
<body>
	<div id="main">
		<h1>${bookmarkletTitle} Install:</h1>
		<h2>v${version} - Generated at <span class="timestamp">buildTimeStampMs</span></h2>
		<p>
		Drag this button to your bookmarks bar to save it as a bookmarklet:
		</p>
		<p>
			${buildHtmlInstallLink(
				`${windowGlobalAccessor}.addInlineTriggerUx()`,
				bookmarkletTitle + ' - Add Inline Buttons'
			)}
		</p>
		<p>
			${buildHtmlInstallLink(
				`${windowGlobalAccessor}.downloadAllMermaidGraphs()`,
				bookmarkletTitle + ' - Download All Mermaid Images (PNG)'
			)}
		</p>
	</div>

	<script>
	document.querySelectorAll('.timestamp').forEach(t => {
		t.innerText = new Date(${buildTimeStampMs}).toLocaleString();
	});
	</script>
</body>
</html>`;

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'index.html'), pageHTML);
