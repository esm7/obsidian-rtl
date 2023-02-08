import { MarkdownPostProcessorContext } from 'obsidian';
import { Direction, detectDirection } from "globals";

let lastDetectedDir: Direction = 'ltr';

// Special nodes are which the direction style should get applied on the parent
// element, Because changing their own direction won't take effect.
const specialNodes = ['A', 'STRONG', 'EM', 'DEL', 'CODE']

/*
 * This recursively breaks multi-line <p> elements into multiple DIVs, to enable the post-processor to set
 * a different text direction to each such line.
 */
function breaksToDivs(el: HTMLElement) {
	if (!el) return;
	if (el.tagName == 'P') {
		const splitText = el.innerHTML.split('<br>');
		if (splitText.length > 1) {
			let newInnerHtml = '';
			splitText.map((line) => { newInnerHtml += `<div class="esm-split">${line}</div>\n`; });
			el.innerHTML = newInnerHtml;
		}
	}
	if (el.children && el.children.length > 0) {
		for (let i = 0; i < el.children.length; i++)
			breaksToDivs(el.children[i] as HTMLElement);
	}
}

// Try to detect if the postprocessor was asked to run inside a canvas element, and in that case, use the
// supplied setPreviewDirection function to launch the plugin logic and set the text to the file's direction.
function detectCanvasElement(el: HTMLElement, ctx: MarkdownPostProcessorContext, setPreviewDirection: SetPreviewDirection) {
	const container = (ctx as any).containerEl as HTMLElement;
	if (container && container.closest) {
		const possibleCanvas = container.closest('.canvas-node-content');
		if (possibleCanvas) {
			const markdownPreview = container.closest('.markdown-preview-view');
			if (markdownPreview && markdownPreview instanceof HTMLDivElement) {
				// Mark this canvas as RTL or LTR
				setPreviewDirection(ctx.sourcePath, markdownPreview);
			}
		}
	}
}

type SetPreviewDirection = (path: string, markdownPreviewElement: HTMLDivElement) => void;

/*
 * This Markdown post-processor handles the Reading view and other rendered components of notes.
 * It detects the direction for each node individually and adds corresponding CSS classes that are
 * later referenced in styles.css.
 */
export const autoDirectionPostProcessor = (el: HTMLElement, ctx: MarkdownPostProcessorContext, setPreviewDirection: SetPreviewDirection) => {
	let shouldAddDir = false, addedDir = false;
	const childNodes = [];
	detectCanvasElement(el, ctx, setPreviewDirection);

	// Obsidian renders adjacent lines as one <p> element with <br> breaks. Since these cannot
	// be set a direction individually, the following breaks them into individual divs.
	breaksToDivs(el);

	for (let i = 0; i < el.childNodes.length; i++) {
		const n = el.childNodes[i];
		if (!addedDir && n.nodeName === '#text' && n.nodeValue && n.nodeValue !== "\n") {
			const dir = detectDirection(n.nodeValue);
			if (dir) {
				addedDir = true;
				lastDetectedDir = dir;
				if (specialNodes.contains(el.nodeName) && el.parentElement) {
					addDirClassIfNotAddedBefore(el.parentElement, dirClass(dir));
				} else {
					el.addClass(dirClass(dir));
					if (el.parentElement && el.parentElement.nodeName === 'LI') {
						addDirClassIfNotAddedBefore(el.parentElement, dirClass(dir));
					}
				}
			}

			shouldAddDir = true;
			continue;
		}

		childNodes.push(n);

		if (i === el.childNodes.length - 1 && shouldAddDir && !addedDir) {
			el.addClass(dirClass(lastDetectedDir));
		}
	}

	for (let i = 0; i < childNodes.length; i++) {
		autoDirectionPostProcessor(childNodes[i] as HTMLElement, ctx, setPreviewDirection);
	}

	if (el.nodeName === "UL") {
		const lis = el.querySelectorAll('li');
		if (lis.length > 0 && lis[0].hasClass('esm-rtl')) {
			el.addClass(dirClass('rtl'));
		}
	}
}

function dirClass(dir: Direction): string {
	if (dir === 'rtl') {
		return 'esm-rtl';
	} else {
		return 'esm-ltr';
	}
}

function addDirClassIfNotAddedBefore(el: HTMLElement, cls: string) {
	if (el.hasClass('esm-rtl') || el.hasClass('esm-ltr')) {
		return;
	}

	el.addClass(cls);
}
