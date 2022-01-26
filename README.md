# Obsidian RTL Plugin

This plugin adds configurable RTL support for [Obsidian](https://obsidian.md).

It relies on the RTL support of [CodeMirror](https://codemirror.net/doc/manual.html), which is the editor component that Obsidian uses.
Although CodeMirror supports just a global direction (no auto-detection by paragraph as we'd all love to have), within this limitation this is the real deal:
Arabic, Hebrew and Farsi can be typed and rendered in Right-to-Left manner just as you'd expect.

To my best knowledge, this is the most comprehensive RTL support any Markdown editor currently has to offer.
Editors like Mark Text and Zettlr that support RTL, do it as a global setting rather than a per-document setting.

**Important note for those using the Obsidian legacy editor!** There is a bug in the latest version that until I get to fix, you can work-around by switching to the new editor momentarily (turn off "Use legacy editor" in Obsidian's Editor settings), then switch it back.

## Usage

Install the plugin via Obsidian's "Third Party Plugins" pane.

When enabled, you will have a "Switch Text Direction" command (accessible via Ctrl/Cmd+P if you have the Command Palette plugin enabled).

**You can map this command to a hotkey:** go to Obsidian's settings, click Hotkeys, search for "RTL" and set your preferred key combination.

## Settings

### Default text direction

This is the direction to use for files on which you have not set an explicit text direction.

Note that Obsidian 0.13.10 introduced basic RTL support.
For the new editor this plugin uses the same basic mechanism as that new support, but it adds a few tweaks and overrides the setting by file.

To make the user experience consistent, the plugin synchronizes the RTL setting from Obsidian's Editor pane to be the same as the "default text direction" setting.

### Remember Text Direction Per File

When enabled (which is the default), when you change the text direction of a file it will be saved.
Every time you open that file it will use the same text direction regardless of the default.
This is useful, for example, if most of your notes are in English (so you want to keep the default LTR) but you have some notes in Arabic/Hebrew/Farsi and you'd like to always edit them in RTL.

If you disable this setting, all notes will load in the default text direction.

If you want to forget the text direction of a file and go back to using the default, remove it from the map in `VAULT_DIR/.obsidian/rtl.json`.

### Front Matter Direction

It's also possible to specify the note direction using a [front matter](https://help.obsidian.md/Advanced+topics/YAML+front+matter):

```
---
direction: rtl
---
```

The front matter direction overrides any other setting.
It is possible to temporarily override a note's direction regardless of the front matter (e.g. to edit or view it differently), but the next time the note is loaded, the front matter direction will always be used.


## Known Issues

- This plugin only treats the Markdown editor, preview and export. There are some areas of the app, like the Outline view, that are not covered for now.
- Obsidian Mobile not yet covered.
- For the legacy editor (CM5):
  - Auto-pair brackets is disabled in RTL ([CodeMirror bug with a pending fix](https://github.com/esm7/obsidian-rtl/issues/7)).
  - When an RTL line ends with an LTR word, the End key misbehaves. [CodeMirror bug](https://github.com/codemirror/CodeMirror/issues/6531).
  - There are various glitches in handling some keyboard shortcuts in RTL, e.g. Ctrl+Home/Ctrl+End are not properly handled yet, Ctrl+Left lands on the wrong character and some others. These are very hard to overcome due to the patchy RTL support of the current CodeMirror versions, and occasionally I'm able to improve things a bit.
  - **None of these issues exist in the new (CM6) editor presented in Obsidian 0.13.x and above.**

## Changelog

### 0.2.0

- Full support for the new (CM6) editor introduced in Obsidian 0.13.x.

### 0.1.0

- Another take at the Home and End keys, trying to make them behave like they should in RTL.
- Added support to setting a note direction via the front matter, as requested [here](https://github.com/esm7/obsidian-rtl/issues/24).
- Added a configurable option to right-align YAML previews as requested [here](https://github.com/esm7/obsidian-rtl/issues/25).

### 0.0.9

- Fixed [incompatibility with the Excalidraw plugin](https://github.com/esm7/obsidian-rtl/issues/20) and improved the plugin's technical behavior overall (it now tries not to override non-Markdown views).

### 0.0.8

- Fixed a bug in the previous release, of some important Obsidian editing behavior (e.g. auto-complete list bullets) being overwritten.

### 0.0.7

- Improved the handling of the Home & End keys (without Shift at this point) in RTL. It's still not perfect (CodeMirror is not good at this) but at least the basic functionality works.
- Some adaptations to the newest Obsidian API.
- Setting the direction of the note title (https://github.com/esm7/obsidian-rtl/issues/15) is now configurable.

### 0.0.6

- Lists are finally rendered properly in RTL, both in Markdown and in Preview!
- The header of RTL notes are now aligned to the right as well.
- Removed debug logs.

### 0.0.5

Export/print support for RTL: https://github.com/esm7/obsidian-rtl/issues/8

### 0.0.4

- Auto-pair brackets patch (https://github.com/esm7/obsidian-rtl/issues/7): until CodeMirror release their fix and Obsidian adapts it, the plugin temporarily disables auto-pair brackets when in RTL mode.
- Patching around Obsidian misbehaving on Home/End keys in RTL mode (https://github.com/esm7/obsidian-rtl/issues/6).

### 0.0.3

- RTL support in preview mode.

### 0.0.2

- Fixed cursor movement on Windows: https://github.com/esm7/obsidian-rtl/issues/3
