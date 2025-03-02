import { MarkdownFileInfo, Notice, WorkspaceLeaf, MarkdownView, Plugin, TFile, TAbstractFile, getIcon, Editor } from 'obsidian';
import { getEditorPlugin, EditorPlugin } from './EditorPlugin';
import { autoDirectionPostProcessor } from './MarkdownPostProcessor';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { Prec } from "@codemirror/state";
import { Direction, LTR_CLASS, RTL_CLASS, AUTO_CLASS } from 'direction.util';
import { Settings, DEFAULT_SETTINGS, RtlSettingsTab } from 'settingsTab';

export default class RtlPlugin extends Plugin {
	public settings: Settings = null;
	private statusBarItem: HTMLElement = null;
	private statusBarText: HTMLElement = null;
	private editorPlugin: ViewPlugin<EditorPlugin>;

	async onload() {
		this.addCommand({
			id: 'switch-text-direction',
			name: 'Switch Text Direction (LTR->RTL->auto)',
			icon: 'arrow-left-right',
			callback: () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view || !view?.editor)
					return;
				this.switchDocumentDirection(view.editor, view);
			}
		});

		await this.convertLegacySettings();
		await this.loadSettings();

		this.editorPlugin = getEditorPlugin(this);
		// It's important to use Prec.lowest here, so our editor extension is called after Obsidian's CodeMirror
		// extensions and can override the direction that they set.
		this.registerEditorExtension(Prec.lowest(this.editorPlugin));
		this.registerMarkdownPostProcessor((el, ctx) => {
			autoDirectionPostProcessor(el, ctx, (path, markdownPreviewElement) => this.setPreviewDirectionByFileSettings(path, markdownPreviewElement));
		});

		this.addSettingTab(new RtlSettingsTab(this.app, this));

		this.app.workspace.on('active-leaf-change', async (leaf: WorkspaceLeaf) => {
			// This creates a redundancy with the flow coming from EditorPlugin, but it seems to be needed
			// for older versions of Obsidian
			// this.adjustDirectionToActiveView();
			// this.updateStatusBar();
		});

		this.app.workspace.on('file-open', async (file: TFile, ctx?: any) => {
			// This creates a redundancy with the flow coming from EditorPlugin, but it seems to be needed
			// for older versions of Obsidian
			// this.adjustDirectionToActiveView();
			// this.updateStatusBar();
		});

		this.registerEvent(this.app.vault.on('delete', (file: TAbstractFile) => {
			if (file && file.path && file.path in this.settings.fileDirections) {
				delete this.settings.fileDirections[file.path];
				this.saveSettings();
			}
		}));

		this.registerEvent(this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
			if (file && file.path && oldPath in this.settings.fileDirections) {
				this.settings.fileDirections[file.path] = this.settings.fileDirections[oldPath];
				delete this.settings.fileDirections[oldPath];
				this.saveSettings();
			}
		}));

		this.statusBarItem = this.addStatusBarItem();
		const languageIcon = getIcon('arrow-left-right');
		this.statusBarItem.appendChild(languageIcon);
		this.statusBarText = this.statusBarItem.createEl('span');
		this.statusBarText.style.marginLeft = '5px';
		this.statusBarItem.title = 'Text direction';
		this.statusBarItem.addClass('mod-clickable');
		this.statusBarItem.addEventListener('click', _ev => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view || !view?.editor)
				return;
			this.switchDocumentDirection(view.editor, view);
		});

		// Because the indicator button won't show properly the direction text when startup
		// or when changing between file, we need to register "file-open" view and
		// set the callback to update the direction text.
		this.registerEvent(this.app.workspace.on("active-leaf-change", leaf => {
			let view = leaf.view;
			if (view instanceof MarkdownView && view.file) {
				let [direction, usedDefault] = this.getRequiredFileDirection(view.file),
					directionStr = direction == "auto"
						? direction
						: direction.toUpperCase();
				if (usedDefault) {
					directionStr = `Default (${directionStr})`;
				} else if (directionStr == "auto") {
					directionStr = "Auto";
				}
				this.statusBarText.textContent = directionStr;
				this.statusBarItem.style.display = null;
			}
			
			else {
				this.hideStatusBar();
			}
		}));
	}

	onunload() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view?.editor) {
			// @ts-expect-error, not typed
			const editorView = view.editor.cm as EditorView;
			this.adjustEditorPlugin(editorView, 'auto');
		}

		console.log('unloading RTL plugin');
	}

	adjustDirectionToActiveView() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view)
			return;
		this.adjustDirectionToView(view);
	}

	// Adjust the direction of a given MarkdownView (editor, Reading view, title etc), optionally
	// using the given editorPlugin in the case this is called from within it.
	adjustDirectionToView(view: MarkdownView, editorPlugin?: EditorPlugin) {
		if (!view)
			return;
		const file = view?.file;
		const editor = view?.editor;
		const editorView = (editor as any)?.cm as EditorView;
		if (file && file.path && editorView) {
			const [requiredDirection, _usedDefault] = this.getRequiredFileDirection(file);
			this.setMarkdownViewDirection(view, editor, editorView, requiredDirection, editorPlugin);
		}
	}

	// Get the direction setup for this file, or the default direction.
	// The 2nd return value denotes whether it was the default direction that was used.
	getRequiredFileDirection(file: TAbstractFile): [Direction, boolean] {
		if (!file) {
			return [this.settings.defaultDirection, true];
		}
		if (!(file instanceof TFile))
			return null;
		let requiredDirection = null;
		const frontMatterDirection = this.getFrontMatterDirection(file);
		// This is true when the file doesn't specify a direction and we used the default value from
		// the settings
		let usedDefault = false;
		if (frontMatterDirection) {
			if (frontMatterDirection == 'rtl' || frontMatterDirection == 'ltr' || frontMatterDirection == 'auto')
				requiredDirection = frontMatterDirection;
			else
				console.log('Front matter direction in file', file.path, 'is unknown:', frontMatterDirection);
		}
		else if (this.settings.rememberPerFile && file.path in this.settings.fileDirections) {
			// If the user wants to remember the direction per file, and we have a direction set for this file -- use it
			requiredDirection = this.settings.fileDirections[file.path];
		} else {
			// Use the default direction
			requiredDirection = this.settings.defaultDirection;
			usedDefault = true;
		}
		return [requiredDirection, usedDefault];
	}

	async saveSettings() {
        await this.saveData(this.settings);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async convertLegacySettings() {
		const legacySettingsPath = '.obsidian/rtl.json';
		if (await this.app.vault.adapter.exists(legacySettingsPath)) {
			const legacyContent = await this.app.vault.adapter.read(legacySettingsPath);
			if (legacyContent) {
				this.settings = JSON.parse(legacyContent);
			}
			this.app.vault.adapter.remove(legacySettingsPath);
			new Notice('RTL Plugin: legacy settings were converted to the new format');
			this.saveSettings();
		}
	}

	// Update the direction status bar item according to the active view
	updateStatusBar() {
		let hide = true;
		let usedDefault = false;
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view?.editor) {
			const direction = this.getDocumentDirection(view.editor, view);
			// If the file is using the settings default direction (i.e. there is no special setting for that
			// file), we want this to be shown to the user
			if (view.file && view.file.path)
				[, usedDefault] = this.getRequiredFileDirection(view.file);
			if (this.settings.statusBar) {
				let directionString = direction === 'auto' ? 'auto' : (direction === 'ltr' ? 'LTR' : 'RTL');
				let statusString = '';
				if (usedDefault)
					statusString = `Default (${direction})`;
				else {
					if (direction === 'auto')
						statusString = 'Auto';
					else
						statusString = directionString;
				}
				this.statusBarText.textContent = statusString;
				this.statusBarItem.style.display = null;
				hide = false;
			}
		}
		if (hide)
			this.hideStatusBar();
	}

	hideStatusBar() {
		this.statusBarItem.style.display = 'none';
	}

	// Set the direction of an editor that's embedded in an iframe, e.g. an editor in a canvas card.
	// We update here only the editor direction and not Reading view, which is handled from a different path,
	// because there currently doesn't seem to be a reliable way to get from the EditorPlugin to
	// the markdown-preview-view container.
	handleIframeEditor(editorDiv: HTMLElement, editorView: EditorView, file: TFile, editorPlugin: EditorPlugin) {
		const isInIframe = editorDiv.closest('.mod-inside-iframe');
		if (isInIframe) {
			if (editorDiv instanceof HTMLDivElement) {
				const [requiredDirection, _] = this.getRequiredFileDirection(file);
				this.adjustEditorPlugin(editorView, requiredDirection, editorPlugin);
				this.setDocumentDirectionForEditorDiv(editorDiv, requiredDirection);
			}
		}
	}

	// This is the main entry point for setting a Markdown view (the "regular" view of Obsidian), which can be either
	// an editor, or a Reading View, to an LTR/RTL/Auto direction.
	// It sets the editor, the Markdown Preview (reading/printing), the note title etc.
	setMarkdownViewDirection(view: MarkdownView, editor: Editor, editorView: EditorView, newDirection: Direction, editorPlugin?: EditorPlugin) {
		if (!view || !editor) {
			this.hideStatusBar();
			return;
		}

		// Adjust the note title
		let title = editorView.dom.querySelector('.inline-title');
		if (!title) {
			title = view.previewMode.containerEl.querySelector('.inline-title');
		}
		title?.setAttribute('dir', newDirection === 'auto' ? 'auto' : '');

		// Adjust the editor for the new direction using the EditorPlugin (either a given one or we find it from the editor)
		this.adjustEditorPlugin(editorView, newDirection, editorPlugin);

		// Adjust the editor for LTR/RTL, bypassing Obsidian's default behavior (auto direction) if needed.
		//
		const editorDivs = view.contentEl.getElementsByClassName('cm-editor');
		for (const editorDiv of editorDivs) {
			if (editorDiv instanceof HTMLDivElement)
				this.setDocumentDirectionForEditorDiv(editorDiv, newDirection);
		}

		// Adjust Markdown Preview / Reading Mode
		const markdownPreviews = view.contentEl.getElementsByClassName('markdown-preview-view');
		for (const preview of markdownPreviews) {
			if (preview instanceof HTMLDivElement)
				this.setDocumentDirectionForReadingDiv(preview, newDirection);
		}

		// --- General global fixes ---

		if (this.settings.setNoteTitleDirection) {
			const container = view.containerEl.parentElement;
			let header = container.getElementsByClassName('view-header-title-container');
			(header[0] as HTMLDivElement).style.direction = newDirection;
		}

		editor.refresh();
	}

	// Adjust the given EditorView for Auto direction.
	// This both sets Auto direction when needed and turns it off if the direction was changed to LTR/RTL (and
	// then the constant LTR/RTL is handled in setDocumentDirectionForEditorDiv).
	// There's a gentle point here: we get here both from applying a change from a command (switch a document direction)
	// and also from the constructor of EditorPlugin when a new editor is created. In the latter case we must
	// use the instance we were given and *not dispatch* an update, which cannot be done from inside the constructor
	// of the editor plugin.
	adjustEditorPlugin(editorView: EditorView, newDirection: Direction, editorPlugin?: EditorPlugin) {
		let dispatchUpdate = false;
		if (!editorPlugin) {
			editorPlugin = editorView.plugin(this.editorPlugin);
			dispatchUpdate = true;
		}
		if (editorPlugin) {
			editorPlugin.setDirection(newDirection, editorView);
			// If we're not inside the context of a specific EditorPlugin, we need to dispatch an update
			// so the editor is refreshed
			if (dispatchUpdate)
				editorView.dispatch();
		}

		let editor = this.app.workspace.activeEditor?.editor;
		let activeEditorView = (editor as any)?.activeCM as EditorView;
		// Check if there any active table cell's EditorView
		if (activeEditorView && (editor as any).inTableCell as boolean) {
			// Retrieve EditorPlugin from the table cell view
			let tableCellEditorPlugin = activeEditorView.plugin(this.editorPlugin);
			tableCellEditorPlugin.setDirection(newDirection, activeEditorView);
			// Update the table cell direction
			activeEditorView.dispatch();
		}
	}

	// Set a constant LTR/RTL direction for an editor if required, bypassing Obsidian's default auto direction.
	// This is done both using a direction style for the editor div and by adding an is-ltr/is-rtl class to the
	// editor div, which is used by some extra CSS rules for various adjustments.
	// editorDiv is the element with the cm-editor class.
	setDocumentDirectionForEditorDiv(editorDiv: HTMLDivElement, newDirection: Direction) {
		editorDiv.style.direction = newDirection === 'auto' ? '' : newDirection;
		this.addDirectionClassToEl(editorDiv.parentElement, newDirection);
	}

	setDocumentDirectionForReadingDiv(readingDiv: HTMLDivElement, newDirection: Direction) {
		readingDiv.style.direction = newDirection === 'auto' ? '' : newDirection;
		// Although Obsidian doesn't care about is-rtl in Markdown preview, we use it below for some more formatting
		this.addDirectionClassToEl(readingDiv, newDirection);
		readingDiv.classList.remove('rtl-yaml');
		if (newDirection !== 'auto' && this.settings.setYamlDirection)
			readingDiv.classList.add('rtl-yaml');
	}

	// This method checks what's the required file direction for the given path and assigns its direction
	// classes accordingly.
	// It is needed for canvas and exports, on which there is no other parent element that includes the 
	// global direction of the document, e.g. the 'is-auto' class.
	setPreviewDirectionByFileSettings(path: string, markdownPreviewElement: HTMLDivElement) {
		const file = this.app.vault.getAbstractFileByPath(path);
		const [requiredDirection, _] = this.getRequiredFileDirection(file);
		this.setDocumentDirectionForReadingDiv(markdownPreviewElement, requiredDirection);
	}

	addDirectionClassToEl(el: HTMLElement|HTMLDivElement, direction: Direction) {
		switch (direction) {
			case 'ltr':
				el.classList.remove(RTL_CLASS);
				el.classList.remove(AUTO_CLASS);
				el.classList.add(LTR_CLASS);
				break;
			case 'rtl':
				el.classList.remove(LTR_CLASS);
				el.classList.remove(AUTO_CLASS);
				el.classList.add(RTL_CLASS);
				break;
			default:
				el.classList.remove(LTR_CLASS);
				el.classList.remove(RTL_CLASS);
				el.classList.add(AUTO_CLASS);
		}
	}

	// This is used for the UI command that switches the active document's direction and cycles
	// between LTR/RTL/Auto.
	switchDocumentDirection(editor: Editor, view: MarkdownView | MarkdownFileInfo) {
		let newDirection = this.getDocumentDirection(editor, view);
		if (newDirection === null) {
			new Notice("Obsidian RTL can't set the direction of this document");
			return;
		}
		let displayName = '';
		switch (newDirection) {
			case 'ltr':
				newDirection = 'rtl';
				displayName = 'RTL';
				break;
			case 'rtl':
				newDirection = 'auto';
				displayName = 'Auto';
				break;
			case 'auto':
				newDirection = 'ltr';
				displayName = 'LTR';
				break;
		}

		if (view instanceof MarkdownView) {
			const editorView = (view.editor as any).cm as EditorView;
			this.setMarkdownViewDirection(view, editor, editorView, newDirection);
			if (this.settings.rememberPerFile && view.file && view.file.path) {
				this.settings.fileDirections[view.file.path] = newDirection;
				this.saveSettings();
			}
			new Notice(`Document direction set to ${displayName}`, 2000);
			this.updateStatusBar();
		} else {
			const canvasView = this.getCanvasContext(view);
			if (canvasView) {
				if (view.file)
					new Notice('To change a canvas card direction, open the document separately and reload the canvas.');
				else
					new Notice("Can't change the direction of a card without a file.");
			}
		}
	}

	// Checks if the given ctx object represents a canvas container (has the canvas-node-content class),
	// and if so, returnes it as an HTMLElement
	getCanvasContext(ctx: MarkdownView | MarkdownFileInfo) {
		if (ctx instanceof MarkdownView)
			return null;
		const possibleCanvasContainer = (ctx as any)?.containerEl as HTMLElement;
		if (possibleCanvasContainer && possibleCanvasContainer.hasClass('canvas-node-content'))
			return possibleCanvasContainer;
	}

	getDocumentDirection(_editor: Editor, ctx: MarkdownView | MarkdownFileInfo): Direction | null {
		// The element that is used for searching for the direction classes
		let refElement = null;
		if (ctx instanceof MarkdownView) {
			refElement = ctx.contentEl;
		} else {
			refElement = this.getCanvasContext(ctx);
		}
		if (refElement === null)
			return null;

		const rtlEditors = refElement.getElementsByClassName(RTL_CLASS),
			autoEditors = refElement.getElementsByClassName(AUTO_CLASS);
		if (rtlEditors.length > 0)
			return 'rtl';
		else if (autoEditors.length > 0)
			return 'auto';
		else
			return 'ltr';
	}

	getFrontMatterDirection(file: TFile) {
		const fileCache = this.app.metadataCache.getFileCache(file);
		const frontMatter = fileCache?.frontmatter;
		if (frontMatter && frontMatter?.direction) {
			try {
				const direction = frontMatter.direction;
				return direction;
			}
			catch (error) {}
		}
	}
}
