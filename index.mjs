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
			const downloadTriggerElem = document.createElement('div');
			downloadTriggerElem.classList.add(triggerClassName);
			downloadTriggerElem.style.cssText = `
				position: absolute;
				top: 30px;
				right: 30px;
				background-color: #ff7676;
				padding: 8px;
				cursor: pointer;
			`;
			downloadTriggerElem.innerHTML = `<span aria-hidden="true">💾</span>`;
			parentContainer.appendChild(downloadTriggerElem);
			downloadTriggerElem.addEventListener('click', () => {
				this.downloadImage(e);
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
	 *
	 * @param {HTMLElement | Element} imageElement
	 */
	async downloadImage(imageElement) {
		const parentBlockId = imageElement.closest('[data-block-id]')?.getAttribute('data-block-id');
		if (imageElement instanceof HTMLImageElement) {
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
			const imageMime = imageFetchRes.headers.get('content-type') || 'image/jpeg';
			const extension = imageMime.split('/')[1];

			return this.downloadImageFromURI(finalImageSrc, `image.${extension}`);
		}
		if (imageElement instanceof SVGElement) {
			// We can use Canvas to re-render the SVG and extract
			const tempCanvas = document.createElement('canvas');
			const ctx = tempCanvas.getContext('2d');
			if (!ctx) {
				return;
			}

			// Workaround for getting the SVG into the canvas
			// Note: DON'T use `createObjectURL`, as that will taint the canvas
			const svgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
				new XMLSerializer().serializeToString(imageElement)
			)}`;
			const image = document.createElement('img');
			image.crossOrigin = 'anonymous';
			const renderAndSaveImage = () => {
				// Resize canvas to match image dimensions
				tempCanvas.width = image.width;
				tempCanvas.height = image.height;
				ctx.drawImage(image, 0, 0, image.width, image.height);
				URL.revokeObjectURL(svgDataUri);
				image.remove();
				// Get data from canvas, trigger download
				const imgURI = tempCanvas.toDataURL('image/png');
				return this.downloadImageFromURI(imgURI, parentBlockId || 'notion_svg_export.png');
			};
			// Trigger load
			image.src = svgDataUri;
			document.body.appendChild(image);
			if (image.complete) {
				renderAndSaveImage();
			} else {
				image.onload = renderAndSaveImage;
			}

			return;
		}

		throw new Error(`Not sure how to download tag of type ${imageElement.tagName}`);
	}

	downloadAllMermaidGraphs() {
		this.codeBlockSVGPreviews.forEach((e) => this.downloadImage(e));
	}
}

// @ts-ignore
window.notionImageExtractor = window.notionImageExtractor || new NotionImageExtractor();
