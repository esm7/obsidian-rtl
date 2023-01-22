import { MarkdownPostProcessorContext } from 'obsidian';
import { Direction, detectDirection } from "globals";

let lastDetectedDir: Direction = 'ltr';

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

/*
 * This Markdown post-processor handles the Reading view and other rendered components of notes.
 * It detects the direction for each node individually and adds corresponding CSS classes that are
 * later referenced in styles.css.
 */
export const autoDirectionPostProcessor = (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
	let shouldAddDir = false, addedDir = false;
	const childNodes = [];

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
				if (el.nodeName === 'A' && el.parentElement) {
					el.parentElement.addClass(dirClass(dir));
				} else {
					el.addClass(dirClass(dir));
					if (el.parentElement && el.parentElement.nodeName === 'LI') {
						el.parentElement.addClass(dirClass(dir));
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
		autoDirectionPostProcessor(childNodes[i] as HTMLElement, ctx);
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
