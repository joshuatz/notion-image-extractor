# Notion-Image-Extractor

🚨 THIS HAS NO AFFILIATION WITH NOTION. Use at your own risk, caveat emptor and all that - you should always be careful with browser bookmarklets or extensions in general.

## What is this?

Who wants to know? 🕵️

JK. This is a client-side bookmarklet (hastily thrown together) that makes it easier to download images from a Notion page, including Mermaid diagram previews as high-resolution PNGs.

> Notion renders Mermaid previews as SVGs, which you can download natively, but for downloading PNGs, I'm using Canvas to render the SVGs onto an exportable surface first.

## How Do I Use It?

First, you need an HTML page with the bookmarklet links - you can either build it yourself (`npm run build`), or you can use the pre-built page [below](#pre-built-bookmarklets).

Next, drag and drop one of the bookmarklet presets to your browser bookmarks.

Finally - to run it - simply click the bookmarklet while on a given Notion page.

## Pre-built Bookmarklets

Find 'em [here](https://jsbin.com/fuzalijega/edit?html,output).

## TODO

- [ ] Add "Copy image to clipboard" inline buttons
