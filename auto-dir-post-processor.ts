import { MarkdownPostProcessorContext } from 'obsidian';
import { RTL, LTR, detectDirection } from "globals";

let lastDetectedDir = LTR;

export const autoDirectionPostProcessor = (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
	let shouldAddDir = false, addedDir = false;
	const childNodes = [];

	for (let i = 0; i < el.childNodes.length; i++) {
		const n = el.childNodes[i];
		if (!addedDir && n.nodeName === '#text' && n.nodeValue && n.nodeValue !== "\n") {
			const dir = detectDirection(n.nodeValue);
			if (dir) {
				addedDir = true;
				lastDetectedDir = dir;
				el.addClass(dirClass(dir));
			}

			shouldAddDir = true;
			continue;
		}

		childNodes.push(n);

		if (i === el.childNodes.length-1 && shouldAddDir && !addedDir) {
			el.addClass(dirClass(lastDetectedDir));
		}
	}

	for (let i = 0; i < childNodes.length; i++) {
		autoDirectionPostProcessor(childNodes[i] as HTMLElement, ctx);
	}

	if (el.nodeName === "UL") {
		const lis = el.querySelectorAll('li');
		if (lis.length > 0 && lis[0].hasClass('esm-rtl')) {
			el.addClass(dirClass(RTL));
		}
	}
}

function dirClass(dir: string): string {
	if (dir === RTL) {
		return 'esm-rtl';
	} else {
		return 'esm-ltr';
	}
}
