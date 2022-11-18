import { App, WorkspaceLeaf, MarkdownView, Plugin, PluginSettingTab, TFile, TAbstractFile, Setting } from 'obsidian';
import * as codemirror from 'codemirror';

class Settings {
	public fileDirections: { [path: string]: string } = {};
	public defaultDirection: string = 'ltr';
	public rememberPerFile: boolean = true;
	public setNoteTitleDirection: boolean = true;
	public setYamlDirection: boolean = false;

	toJson() {
		return JSON.stringify(this,null, "\t");
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
	// This stores the value in CodeMirror's autoCloseBrackets option before overriding it, so it can be restored when
	// we're back to LTR
	private autoCloseBracketsValue: any = false;
	private initialized = false;

	onload() {
		this.addCommand({
			id: 'switch-text-direction',
			name: 'Switch Text Direction (LTR<>RTL)',
			callback: () => { this.toggleDocumentDirection(); }
		});

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

	}

	async initialize() {
		this.initialized = true;
	}

	onunload() {
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
			if (frontMatterDirection) {
				if (frontMatterDirection == 'rtl' || frontMatterDirection == 'ltr')
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
			}
			this.setDocumentDirection(requiredDirection);
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

	getCmEditor(): codemirror.Editor {
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view)
			return view.sourceMode?.cmEditor;
		return null;
	}

	setDocumentDirection(newDirection: string) {
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || !view?.editor)
			return;

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
		
		// Fix list indentation problems in RTL
		this.replacePageStyleByString('List indent fix',
			`/* List indent fix */ .is-rtl .HyperMD-list-line { text-indent: 0px !important; }`, true);
		this.replacePageStyleByString('CodeMirror-rtl pre',
			`.CodeMirror-rtl pre { text-indent: 0px !important; }`,
			true);

		// Embedded backlinks should always be shown as LTR
		this.replacePageStyleByString('Embedded links always LTR',
			`/* Embedded links always LTR */ .embedded-backlinks { direction: ltr; }`, true);

		// Fold indicator fix (not perfect yet -- it can't be clicked)
		this.replacePageStyleByString('Fold symbol fix',
			`/* Fold symbol fix*/ .is-rtl .cm-fold-indicator { right: -15px !important; }`, true);

		if (this.settings.setNoteTitleDirection) {
			const container = view.containerEl.parentElement;
			let header = container.getElementsByClassName('view-header-title-container');
			(header[0] as HTMLDivElement).style.direction = newDirection;
		}

		view.editor.refresh();

		// Set the *currently active* export direction. This is global and changes every time the user
		// switches a pane
		this.setExportDirection(newDirection);
	}

	setDocumentDirectionForEditorDiv(editorDiv: HTMLDivElement, newDirection: string) {
		editorDiv.style.direction = newDirection;
		if (newDirection === 'rtl') {
			editorDiv.parentElement.classList.add('is-rtl');
		} else {
			editorDiv.parentElement.classList.remove('is-rtl');
		}
	}

	setDocumentDirectionForReadingDiv(readingDiv: HTMLDivElement, newDirection: string) {
		readingDiv.style.direction = newDirection;
		// Although Obsidian doesn't care about is-rtl in Markdown preview, we use it below for some more formatting
		if (newDirection === 'rtl')
			readingDiv.classList.add('is-rtl');
		else
			readingDiv.classList.remove('is-rtl');
		if (this.settings.setYamlDirection)
			this.replacePageStyleByString('Patch YAML',
				`/* Patch YAML RTL */ .is-rtl .language-yaml code { text-align: right; }`, true);
	}

	setExportDirection(newDirection: string) {
		this.replacePageStyleByString('searched and replaced',
			`/* This is searched and replaced by the plugin */ @media print { body { direction: ${newDirection}; } }`,
			false);
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

	toggleDocumentDirection() {
		let newDirection = this.getDocumentDirection() === 'ltr' ? 'rtl' : 'ltr';
		this.setDocumentDirection(newDirection);
		if (this.settings.rememberPerFile && this.currentFile && this.currentFile.path) {
			this.settings.fileDirections[this.currentFile.path] = newDirection;
			this.saveSettings();
		}
	}

	getDocumentDirection() {
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view)
			return 'unknown';
		const rtlEditors = view.contentEl.getElementsByClassName('is-rtl');
		if (rtlEditors.length > 0)
			return 'rtl';
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
		if (obsidianDirection != this.settings.defaultDirection) {
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
			.addDropdown(dropdown => dropdown.addOption('ltr', 'LTR')
						 .addOption('rtl', 'RTL')
						 .setValue(this.settings.defaultDirection)
						 .onChange((value) => {
							 this.settings.defaultDirection = value;
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
	}
}
