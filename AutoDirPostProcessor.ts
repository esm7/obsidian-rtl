import { MarkdownPostProcessorContext } from 'obsidian';
import { Direction, detectDirection } from './direction.util';

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
			splitText.map((line) => { newInnerHtml += `<div class="esm-split">${line}</div>`; });
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
function detectCanvasElement(ctx: MarkdownPostProcessorContext, setPreviewDirection: SetPreviewDirection) {
	const container = ctx ? (ctx as any).containerEl as HTMLElement : null;
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

// Try to detect if the postprocessor was asked to render an export, which seems to be the only case on which
// the post processor is called with a top-level Markdown Preview View div.
// In this case, we must add the relevant document direction class to that element, because no one else will.
function detectExport(el: HTMLElement, ctx: MarkdownPostProcessorContext, setPreviewDirection: SetPreviewDirection) {
	if (el?.classList && el.classList?.contains('markdown-preview-view')) {
		setPreviewDirection(ctx.sourcePath, el as HTMLDivElement);
	}
}

type SetPreviewDirection = (path: string, markdownPreviewElement: HTMLDivElement) => void;

/*
 * This Markdown post-processor handles the Reading view and other rendered components of notes.
 * It detects the direction for each node individually and adds corresponding CSS classes that are
 * later referenced in styles.css.
 */
export const autoDirectionPostProcessor = (
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
	setPreviewDirection: SetPreviewDirection,
) => {
	let shouldAddDir = false, addedDir = false;
	detectCanvasElement(ctx, setPreviewDirection);

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
				if (specialNodes.includes(el.nodeName) && el.parentElement) {
					let target = nonSpecialParent(el.parentElement);
					if (target && 
						/* If parent (target) has text with strong direction before this special node then don't change the parent direction */
						!(target.childNodes.length !== 0 && target.childNodes[0].nodeValue && detectDirection(target.childNodes[0].nodeValue))) {
						addDirClass(target, dirClass(dir));
					}
				} else {
					addDirClass(el, dirClass(dir));
					if (el.parentElement && el.parentElement.nodeName === 'LI') {
						addDirClass(el.parentElement, dirClass(dir));
					}
				}
			}

			shouldAddDir = true;
			continue;
		}

		autoDirectionPostProcessor(n as HTMLElement, ctx, setPreviewDirection);

		if (i === el.childNodes.length - 1 && shouldAddDir && !addedDir) {
			el.classList.add(dirClass(lastDetectedDir));
		}
	}

	if (el.nodeName === "UL") {
		const lis = el.querySelectorAll('li');
		if (lis.length > 0 && lis[0].classList.contains('esm-rtl')) {
			el.classList.add(dirClass('rtl'));
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

function addDirClass(el: HTMLElement, cls: string) {
	if (el.classList.contains(cls)) {
		return;
	}
	el.classList.remove('esm-rtl', 'esm-ltr');
	el.classList.add(cls);
}

function nonSpecialParent(el: HTMLElement) {
	while (specialNodes.includes(el.nodeName)) {
		el = el.parentElement;
	}

	return el;
}
