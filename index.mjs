// @ts-check

class NotionImageExtractor {
	inlineTriggerUxAdded = false;

	addInlineTriggerUx() {
		const triggerClassName = 'notionImageExtractorTrigger';
		if (this.inlineTriggerUxAdded) {
			return;
		}
		[...this.codeBlockSVGPreviews, ...this.regularImageElements].forEach((e) => {
			const parentContainer = e.parentElement;
			if (!parentContainer || parentContainer.querySelector(`.${triggerClassName}`)) {
				return;
			}
			const triggerButtonCss = `
				position: absolute;
				top: 30px;
				right: 30px;
				background-color: #ff7676;
				padding: 8px;
				cursor: pointer;
			`;
			// Direct download button
			const downloadTriggerElem = document.createElement('div');
			downloadTriggerElem.title = 'Download Image';
			downloadTriggerElem.classList.add(triggerClassName);
			downloadTriggerElem.style.cssText = triggerButtonCss + '\n' + 'right: 30px;';
			downloadTriggerElem.innerHTML = `<span aria-hidden="true">💾</span>`;
			parentContainer.appendChild(downloadTriggerElem);
			downloadTriggerElem.addEventListener('click', () => {
				this.downloadImage(e);
			});
			// Copy to clipboard
			const copyTriggerElem = document.createElement('div');
			copyTriggerElem.title = 'Copy to Clipboard';
			copyTriggerElem.classList.add(triggerClassName);
			copyTriggerElem.style.cssText = triggerButtonCss + '\n' + 'right: 70px;';
			copyTriggerElem.innerHTML = `<span aria-hidden="true">📋</span>`;
			parentContainer.appendChild(copyTriggerElem);
			copyTriggerElem.addEventListener('click', async (evt) => {
				/** @type {Record<string, Blob>} */
				let clipboardContents = {};
				/** @type {ClipboardItem | null} */
				let clipboardItem = null;
				/** @type {Blob | null} */
				let pngImageBlob = null;
				if (e instanceof HTMLImageElement) {
					const { mime, imageFetchRes } = await this.getNotionImageTrueSourceAndMime(e);
					clipboardContents = {
						'text/plain': new Blob([e.src], { type: 'text/plain' }),
					};
					if (mime !== 'image/png') {
						// Async clipboard API pretty much only likes PNGs
						// TODO: Probably better supported in the future
						// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api
						const { tempCanvas } = await this.drawImageToCanvas(e);
						/** @type {Parameters<BlobCallback>[0]} */
						pngImageBlob = await new Promise((res) => tempCanvas.toBlob(res, 'image/png'));
					} else {
						pngImageBlob = await imageFetchRes.blob();
					}
				} else if (e instanceof SVGElement) {
					const { tempCanvas } = await this.convertSvgToCanvas(e);
					pngImageBlob = await new Promise((res) => tempCanvas.toBlob(res, 'image/png'));
					tempCanvas.remove();
					/** @type {Record<`${string}/${string}`, Blob>} */
					clipboardContents = {
						'text/html': new Blob([e.innerHTML], { type: 'text/html' }),
					};
				} else {
					throw new Error(`Could not parse element ${e.nodeType}`);
				}
				if (pngImageBlob) {
					// Special mime handling
					clipboardContents[`image/png`] = pngImageBlob;
					if (!(evt.ctrlKey || evt.metaKey)) {
						// If modifier key was not held down, remove the
						// `text/html` entry, as this interferes with image
						// pasting in applications that will let the text
						// entry take priority over the file blob
						delete clipboardContents['text/html'];
						delete clipboardContents['text/plain'];
					}
				}
				clipboardItem = new ClipboardItem(clipboardContents);
				navigator.clipboard.write([clipboardItem]);
			});
		});
	}

	get codeBlockSVGPreviews() {
		return document.querySelectorAll('main .notion-code-block svg[id]');
	}

	get regularImageElements() {
		return document.querySelectorAll('main [data-block-id] img');
	}

	/** @returns {string} */
	get pageId() {
		// Page block should also be the very first element with a data-block-id attr
		const pageHeadingBlock = document.querySelector('.notion-page-block[data-block-id]');
		const pageId = pageHeadingBlock?.getAttribute('data-block-id');
		if (!pageId) {
			throw new Error('Could not locate page ID');
		}
		return pageId;
	}

	get specialIds() {
		// spaceId and userId can both be extracted out of image elements in the page
		// (e.g. space switcher)
		// @ts-ignore
		const spaceId = document
			.querySelector('img[src*="/image/"][src*="spaceId="]')
			?.getAttribute('src')
			?.match(/spaceId=([a-z0-9-]+)/i)[1];
		// @ts-ignore
		const userId = document
			.querySelector('img[src*="/image/"][src*="userId="]')
			?.getAttribute('src')
			?.match(/userId=([a-z0-9-]+)/i)[1];
		return { userId, spaceId };
	}

	/**
	 * Only certain API routes use these
	 *
	 * @returns {Record<string, string>}
	 */
	get specialNotionHeaders() {
		try {
			// spaceId and userId can both be extracted out of image elements in the page
			// (e.g. space switcher)
			// @ts-ignore
			const { spaceId, userId } = this.specialIds;
			if (!spaceId || !userId) {
				throw new Error('Could not extract special notion headers');
			}
			return { 'x-notion-space-id': spaceId, 'x-notion-active-user-header': userId };
		} catch (e) {
			console.warn(e);
			return {};
		}
	}

	/**
	 * @param {string} imageUri
	 * @param {string} [filename]
	 */
	downloadImageFromURI(imageUri, filename) {
		const tempAnchor = document.createElement('a');
		tempAnchor.target = '_blank';
		tempAnchor.href = imageUri;
		tempAnchor.setAttribute('download', filename || imageUri.split('/').pop() || imageUri);
		tempAnchor.dispatchEvent(
			new MouseEvent('click', {
				bubbles: false,
				cancelable: true,
			})
		);
	}

	/**
	 * Images in a notion page can be wrapped in a weird way where the true
	 * image source is actually other than the direct `src` attribute
	 * @param {HTMLElement | Element} imageElement
	 */
	async getNotionImageTrueSourceAndMime(imageElement) {
		const parentBlockId = imageElement.closest('[data-block-id]')?.getAttribute('data-block-id');
		// Note: We can't just use image's `src` to prompt a download,
		// because that doesn't work if the source is cross-origin (e.g.
		// an image embed)
		if (!parentBlockId) {
			throw new Error('Could not locate parent block');
		}
		/** @type {{fileName: string, url: string}} */
		const notionHostedImageResponse = await (
			await fetch(`https://www.notion.so/api/v3/getBlockFileDownloadUrl`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					blockId: parentBlockId,
					meta: {
						name: 'downloadSource',
					},
					pageBlockId: this.pageId,
				}),
			})
		).json();

		const { spaceId, userId } = this.specialIds;

		const finalImageSrc = `https://www.notion.so/image/${encodeURIComponent(
			notionHostedImageResponse.url
		)}?table=block&id=${parentBlockId}&spaceId=${spaceId}&userId=${userId}&cache=v2`;

		// Fetch image to get mime
		const imageFetchRes = await fetch(finalImageSrc);
		const mime = imageFetchRes.headers.get('content-type') || 'image/jpeg';
		const extension = mime.split('/')[1];

		return {
			finalImageSrc,
			imageFetchRes,
			mime,
			extension,
		};
	}

	/**
	 * Create an untainted canvas from an SVG element
	 * @param {SVGElement} svgElement
	 * @returns {Promise<{tempCanvas: HTMLCanvasElement, svgDataUri: string, ctx: CanvasRenderingContext2D}>}
	 **/
	async convertSvgToCanvas(svgElement) {
		// Workaround for getting the SVG into the canvas
		// Note: DON'T use `createObjectURL`, as that will taint the canvas
		const svgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
			new XMLSerializer().serializeToString(svgElement)
		)}`;
		const { ctx, image, tempCanvas } = await this.drawImageToCanvas(svgDataUri);
		image.remove();
		return { tempCanvas, svgDataUri, ctx };
	}

	/**
	 *
	 * @param {string | HTMLImageElement} imageElementOrSrc
	 * @returns {Promise<{tempCanvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, image: HTMLImageElement}>}
	 */
	drawImageToCanvas(imageElementOrSrc) {
		return new Promise((res, rej) => {
			const tempCanvas = document.createElement('canvas');
			const ctx = tempCanvas.getContext('2d');
			if (!ctx) {
				rej('Could not create canvas ctx');
				return;
			}
			let image = imageElementOrSrc;
			if (typeof image === 'string') {
				image = document.createElement('img');
			}
			image.crossOrigin = 'anonymous';

			const renderAndSaveImage = () => {
				// Resize canvas to match image dimensions
				tempCanvas.width = image.width;
				tempCanvas.height = image.height;
				ctx.drawImage(image, 0, 0, image.width, image.height);
				// Callback / end promise
				res({
					tempCanvas,
					ctx,
					image,
				});
			};
			if (typeof imageElementOrSrc === 'string') {
				// Trigger load
				image.src = imageElementOrSrc;
				document.body.appendChild(image);
			}
			if (image.complete) {
				renderAndSaveImage();
			} else {
				image.onload = renderAndSaveImage;
			}
		});
	}

	/**
	 *
	 * @param {HTMLElement | Element} imageElement
	 */
	async downloadImage(imageElement) {
		const parentBlockId = imageElement.closest('[data-block-id]')?.getAttribute('data-block-id');
		if (imageElement instanceof HTMLImageElement) {
			const { finalImageSrc, extension } = await this.getNotionImageTrueSourceAndMime(imageElement);
			return this.downloadImageFromURI(finalImageSrc, `image.${extension}`);
		}
		if (imageElement instanceof SVGElement) {
			const { tempCanvas } = await this.convertSvgToCanvas(imageElement);

			// Get data from canvas, trigger download
			const imgURI = tempCanvas.toDataURL('image/png');
			tempCanvas.remove();
			return this.downloadImageFromURI(imgURI, parentBlockId || 'notion_svg_export.png');
		}

		throw new Error(`Not sure how to download tag of type ${imageElement.tagName}`);
	}

	downloadAllMermaidGraphs() {
		this.codeBlockSVGPreviews.forEach((e) => this.downloadImage(e));
	}
}

// @ts-ignore
window.notionImageExtractor = window.notionImageExtractor || new NotionImageExtractor();
