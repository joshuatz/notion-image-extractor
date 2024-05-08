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

### Copy to Clipboard Buttons

> Due to a limitation in the clipboard web API, currently the only supported *target* mime type for the clipboard is `image/png`. As a workaround, this bookmarklet will convert non-PNG sources (JPGs, SVGs) to PNG, within the browser, using Canvas as a converter.

If you use the "Add inline buttons" bookmarklet, one of the inline buttons that gets added is a "copy to clipboard" button.

Operating in it's default mode, this will copy an image (and *only* an image) to your clipboard.

However, if you hold down a modifier key (CTRL on Win, CMD on MacOS) while left-clicking, it will also copy the text representation of the item to your clipboard at the same time - such as the HTML source of an SVG image, or the URL source of a remote image. This is not done by default because many applications ignore the `image/*` part of a clipboard buffer if there is a `text/*` item present (as it will prefer the text content).

## Pre-built Bookmarklets

Find 'em [here](https://jsbin.com/janebesulu/edit?html,output).

## Releases

Version | Date | Notes
--- | --- | ---
1.0.0 | 2024-05-06 | Initial Release
1.1.0 | 2024-05-08 | Add copy-to-clipboard support, refactor
