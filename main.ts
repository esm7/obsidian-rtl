import { Notice, App, WorkspaceLeaf, MarkdownView, Plugin, PluginSettingTab, TFile, TAbstractFile, Setting } from 'obsidian';
import { autoDirectionPlugin } from './AutoDirPlugin';
import { autoDirectionPostProcessor } from './AutoDirPostProcessor';
import { EditorView } from '@codemirror/view';

type Direction = 'ltr' | 'rtl' | 'auto';
const RTL_CLASS = 'is-rtl';
const AUTO_CLASS = 'is-auto';

class Settings {
	public fileDirections: { [path: string]: Direction } = {};
	public defaultDirection: Direction = 'ltr';
	public rememberPerFile: boolean = true;
	public setNoteTitleDirection: boolean = true;
	public setYamlDirection: boolean = false;
	public statusBar: boolean = true;

	toJson() {
		return JSON.stringify(this);
	}

	fromJson(content: string) {
		var obj = JSON.parse(content);
		this.fileDirections = obj['fileDirections'];
		this.defaultDirection = obj['defaultDirection'];
		this.rememberPerFile = obj['rememberPerFile'];
		this.setNoteTitleDirection = obj['setNoteTitleDirection'];
	}
}

export default class RtlPlugin extends Plugin {
	public settings = new Settings();
	private currentFile: TFile;
	public SETTINGS_PATH = '.obsidian/rtl.json'
	private initialized = false;
	private statusBarItem: HTMLElement = null;

	onload() {
		this.addCommand({
			id: 'switch-text-direction',
			name: 'Switch Text Direction (LTR->RTL->auto)',
			callback: () => { this.switchDocumentDirection(); }
		});

		this.registerEditorExtension(autoDirectionPlugin);
		this.registerEditorExtension(EditorView.perLineTextDirection.of(true));
		this.registerMarkdownPostProcessor(autoDirectionPostProcessor);

		this.addSettingTab(new RtlSettingsTab(this.app, this));

		this.loadSettings();

		this.app.workspace.on('active-leaf-change', async (leaf: WorkspaceLeaf) => {
			if (leaf.view instanceof MarkdownView) {
				const file = leaf.view.file;
				await this.onFileOpen(file);
			}
		});

		this.app.workspace.on('file-open', async (file: TFile) => {
			await this.onFileOpen(file);
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
		this.statusBarItem.title = 'Text direction';
		this.statusBarItem.addClass('mod-clickable');
		this.statusBarItem.addEventListener('click', _ev => {
			this.switchDocumentDirection();
		});
	}

	async initialize() {
		this.initialized = true;
	}

	onunload() {
		// TODO unload
		// const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		// if (view && view?.editor) {
		// 	// @ts-expect-error, not typed
		// 	const editorView = view.editor.cm as EditorView;
		// 	const plugin = editorView.plugin(autoDirectionPlugin);
		// 	if (plugin) {
		// 		plugin.setActive(false, editorView);
		// 	}
		// }

		console.log('unloading RTL plugin');
	}

	async onFileOpen(file: TFile) {
		if (!this.initialized)
			await this.initialize();
		if (file && file.path) {
			this.syncDefaultDirection();
			this.currentFile = file;
			this.adjustDirectionToCurrentFile();
		}
	}

	adjustDirectionToCurrentFile() {
		if (this.currentFile && this.currentFile.path) {
			let requiredDirection = null;
			const frontMatterDirection = this.getFrontMatterDirection(this.currentFile);
			let usedDefault = false;
			if (frontMatterDirection) {
				if (frontMatterDirection == 'rtl' || frontMatterDirection == 'ltr' || frontMatterDirection == 'auto')
					requiredDirection = frontMatterDirection;
				else
					console.log('Front matter direction in file', this.currentFile.path, 'is unknown:', frontMatterDirection);
			}
			else if (this.settings.rememberPerFile && this.currentFile.path in this.settings.fileDirections) {
				// If the user wants to remember the direction per file, and we have a direction set for this file -- use it
				requiredDirection = this.settings.fileDirections[this.currentFile.path];
			} else {
				// Use the default direction
				requiredDirection = this.settings.defaultDirection;
				usedDefault = true;
			}
			this.setDocumentDirection(requiredDirection, usedDefault);
		}
	}

	saveSettings() {
		var settings = this.settings.toJson();
		this.app.vault.adapter.write(this.SETTINGS_PATH, settings);
	}

	loadSettings() {
		this.app.vault.adapter.read(this.SETTINGS_PATH).
			then((content) => this.settings.fromJson(content)).
			catch(error => { console.log("RTL settings file not found"); });
	}

	setStatusBar(direction: Direction, usedDefault: boolean) {
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
			this.statusBarItem.textContent = statusString;
			this.statusBarItem.style.display = null;
		} else {
			this.statusBarItem.style.display = 'none';
			this.statusBarItem.textContent = '';
		}
	}

	setDocumentDirection(newDirection: Direction, usedDefault: boolean) {
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || !view?.editor)
			return;

		this.setStatusBar(newDirection, usedDefault);

		//@ts-ignore
		const editorView = view.editor.cm as EditorView;
		const autoDirection = editorView.plugin(autoDirectionPlugin);
		if (autoDirection) {
			autoDirection.setActive(newDirection === 'auto', editorView);
			let title = editorView.dom.querySelector('.inline-title');
			if (!title) {
				title = view.previewMode.containerEl.querySelector('.inline-title');
			}
			title?.setAttribute('dir', newDirection === 'auto' ? 'auto' : '');
		}

		const editorDivs = view.contentEl.getElementsByClassName('cm-editor');
		for (const editorDiv of editorDivs) {
			if (editorDiv instanceof HTMLDivElement)
				this.setDocumentDirectionForEditorDiv(editorDiv, newDirection);
		}
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

		view.editor.refresh();

		// Set the *currently active* export direction. This is global and changes every time the user
		// switches a pane
		if (newDirection !== 'auto') {
			this.setExportDirection(newDirection);
		}
	}

	setDocumentDirectionForEditorDiv(editorDiv: HTMLDivElement, newDirection: Direction) {
		editorDiv.style.direction = newDirection === 'auto' ? '' : newDirection;
		this.addDirectionClassToEl(editorDiv.parentElement, newDirection);
	}

	setDocumentDirectionForReadingDiv(readingDiv: HTMLDivElement, newDirection: Direction) {
		readingDiv.style.direction = newDirection === 'auto' ? '' : newDirection;
		// Although Obsidian doesn't care about is-rtl in Markdown preview, we use it below for some more formatting
		this.addDirectionClassToEl(readingDiv, newDirection);
		readingDiv.classList.remove('rtl-yaml');
		if (newDirection !== 'auto')
			readingDiv.classList.add('rtl-yaml');
	}

	addDirectionClassToEl(el: HTMLElement|HTMLDivElement, direction: Direction) {
		switch (direction) {
			case 'rtl':
				el.classList.remove(AUTO_CLASS);
				el.classList.add(RTL_CLASS);
				break;
			case 'auto':
				el.classList.remove(RTL_CLASS);
				el.classList.add(AUTO_CLASS);
				break;
			default:
				el.classList.remove(RTL_CLASS);
				el.classList.remove(AUTO_CLASS);
		}
	}

	setExportDirection(newDirection: Direction) {
		this.replacePageStyleByString('searched and replaced',
			`/* This is searched and replaced by the plugin */ @media print { body { direction: ${newDirection}; } }`,
			true);
	}

	// Returns true if a replacement was made
	replacePageStyleByString(searchString: string, newStyle: string, addIfNotFound: boolean) {
		let alreadyExists = false;
		let style = this.findPageStyle(searchString);
		if (style) {
			if (style.getText() === searchString)
				alreadyExists = true;
			else
				style.setText(newStyle);
		} else if (addIfNotFound) {
			let style = document.createElement('style');
			style.textContent = newStyle;
			document.head.appendChild(style);
		}
		return style && !alreadyExists;
	}

	findPageStyle(regex: string) {
		let styles = document.head.getElementsByTagName('style');
		for (let style of styles) {
			if (style.getText().match(regex))
				return style;
		}
		return null;
	}

	switchDocumentDirection() {
		let newDirection = this.getDocumentDirection();
		switch (newDirection) {
			case 'ltr':
				newDirection = 'rtl';
				break;
			case 'rtl':
				newDirection = 'auto';
				break;
			case 'auto':
				newDirection = 'ltr';
				break;
		}
		new Notice(`Document direction set to ${newDirection}`, 500);

		this.setDocumentDirection(newDirection);
		if (this.settings.rememberPerFile && this.currentFile && this.currentFile.path) {
			this.settings.fileDirections[this.currentFile.path] = newDirection;
			this.saveSettings();
		}
	}

	getDocumentDirection(): Direction {
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view)
			return 'ltr';

		const rtlEditors = view.contentEl.getElementsByClassName(RTL_CLASS),
			autoEditors = view.contentEl.getElementsByClassName(AUTO_CLASS);
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

	syncDefaultDirection() {
		// Sync the plugin default direction with Obsidian's own setting
		const obsidianDirection = (this.app.vault as any).getConfig('rightToLeft') ? 'rtl' : 'ltr';
		if (obsidianDirection != this.settings.defaultDirection &&
			this.settings.defaultDirection !== 'auto') {
			this.settings.defaultDirection = obsidianDirection;
			this.saveSettings();
		}
	}
}

class RtlSettingsTab extends PluginSettingTab {
	settings: Settings;
	plugin: RtlPlugin;

	constructor(app: App, plugin: RtlPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = plugin.settings;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'RTL Settings'});

		this.plugin.syncDefaultDirection();

		new Setting(containerEl)
			.setName('Remember text direction per file')
			.setDesc('Store and remember the text direction used for each file individually.')
			.addToggle(toggle => toggle.setValue(this.settings.rememberPerFile)
					   .onChange((value) => {
						   this.settings.rememberPerFile = value;
						   this.plugin.saveSettings();
						   this.plugin.adjustDirectionToCurrentFile();
					   }));

		new Setting(containerEl)
			.setName('Default text direction')
			.setDesc('What should be the default text direction in Obsidian?')
			.addDropdown(dropdown => dropdown
						 .addOption('ltr', 'LTR')
						 .addOption('rtl', 'RTL')
						 .addOption('auto', 'Auto')
						 .setValue(this.settings.defaultDirection)
						 .onChange((value) => {
							 this.settings.defaultDirection = value as Direction;
							 (this.app.vault as any).setConfig('rightToLeft', value == 'rtl');
							 this.plugin.saveSettings();
							 this.plugin.adjustDirectionToCurrentFile();
						 }));

		new Setting(containerEl)
			.setName('Set note title direction')
			.setDesc('In RTL notes, also set the direction of the note title.')
			.addToggle(toggle => toggle.setValue(this.settings.setNoteTitleDirection)
						 .onChange((value) => {
							 this.settings.setNoteTitleDirection = value;
							 this.plugin.saveSettings();
							 this.plugin.adjustDirectionToCurrentFile();
						 }));

		new Setting(containerEl)
			.setName('Set YAML direction in Preview')
			.setDesc('For RTL notes, preview YAML blocks as RTL. (When turning off, restart of Obsidian is required.)')
			.addToggle(toggle => toggle.setValue(this.settings.setYamlDirection ?? false)
						 .onChange((value) => {
							 this.settings.setYamlDirection = value;
							 this.plugin.saveSettings();
							 this.plugin.adjustDirectionToCurrentFile();
						 }));

		new Setting(containerEl)
			.setName('Show status bar item')
			.setDesc('Show a clickable status bar item showing the current direction.')
			.addToggle(toggle => toggle.setValue(this.settings.statusBar ?? true)
				.onChange((value) => {
					this.settings.statusBar = value;
					this.plugin.saveSettings();
					this.plugin.adjustDirectionToCurrentFile();
				}));
	}
}
