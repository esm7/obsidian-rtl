# Obsidian RTL Plugin

This plugin adds configurable RTL support for [Obsidian](https://obsidian.md).

It relies on the RTL `direction` property of [CodeMirror](https://codemirror.net/doc/manual.html), which is the editor component that Obsidian uses.
Although CodeMirror supports just a global direction (no auto-detection by paragraph as we'd all love to have), within this limitation this is the real deal:
Arabic, Hebrew and Farsi can be typed and rendered in Right-to-Left manner just as you'd expect.

To my best knowledge, this is the most comprehensive RTL support any Markdown editor currently has to offer.
Editors like Mark Text and Zettlr that support RTL, do it as a global setting rather than a per-document setting.

## Usage

Install the plugin via Obsidian's "Third Party Plugins" pane.

When enabled, you will have a "Switch Text Direction" command (accessible via Ctrl/Cmd+P if you have the Command Palette plugin enabled).

**You can map this command to a hotkey:** go to Obsidian's settings, click Hotkeys, search for "RTL" and set your preferred key combination.

## Settings

### Default text direction

This is the direction to use for files on which you have not set an explicit text direction.

### Remember text direction per file

When enabled (which is the default), when you change the text direction of a file it will be saved.
Every time you open that file it will use the same text direction regardless of the default.
This is useful, for example, if most of your notes are in English (so you want to keep the default LTR) but you have some notes in Arabic/Hebrew/Farsi and you'd like to always edit them in RTL.

If you disable this setting, all notes will load in the default text direction.

If you want to forget the text direction of a file and go back to using the default, remove it from the map in `VAULT_DIR/.obsidian/rtl.json`.

## Known Issues

- Minor visual glitches in RTL mode, e.g. alignment of bullets is not exactly as you'd expect. I believe some CSS wizardry can fix this.
- This plugin only treats the Markdown editor. I personally don't use the Markdown preview/rendering so I didn't work on that one. Let me know if you find that important, or open a PR to make it work if you can :)
- The plugin outputs some debug info to the console, I'll remove these when I gain more confidence everything works as expected.

## Changelog

### 0.0.3

- RTL support in preview mode.

### 0.0.2

- Fixed cursor movement on Windows: https://github.com/esm7/obsidian-rtl/issues/3
