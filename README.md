<div align="center">
<picture>
  <img alt="Light mode" src="https://github.com/Quorafind/Outliner.md/blob/main/assets/outliner-md.png">
</picture>
<p>Enhancing your Obsidian outliner experience.</p>
</div>

<img alt="GitHub Release" src="https://img.shields.io/github/downloads/quorafind/outliner.md/total?color=%23d12828"> <img alt="GitHub Release" src="https://img.shields.io/github/v/release/quorafind/outliner.md?color=%23d12828">

## Documentation

Visit the [Outliner.md docs](https://docs.outliner.md) for more information.

## Features

> You need to install `Obsidian Zoom`, `Obsidian Outliner` and also `Obsidian Dataview` plugins to use this plugin better.

> [!warning]
> You need to add `outliner: true` to the frontmatter of the note to enable the outliner view.

### 💭 Smoother outliner experience

Filter, hotkey and more, just like you are using outliner software.

### 💫 Embedded content editing

Embed anything and then edit it there.

### 📚 Backlink editing

Just open your note, scroll to the bottom, and you can edit the backlinks directly.

### Roadmap

- [x] Website for [Outliner.md](https://outliner.md);
- [x] Doc site: [Outliner.md docs](https://docs.outliner.md);
- Support fully outliner support;
  - Drag and drop;
  - Keyboard shortcuts;
  - Custom task group;
  - Better selection;
- [x] Support fully embed content editing;
- [x] Support backlink editing;
- [ ] Support infinite outliner view;
- [ ] Support date filter;
- [ ] Support `@` people filter;
- [ ] Print to PDF;
- [ ] Import opml;
- [ ] Kanban/board mode for list;


### Style

You can add css snippet to make the embed content more obvious.

```css
.internal-embed.is-loaded:not(.embedded-part):has(.markdown-source-view):before {
	content: ' ';
	width: 1px;
	position: absolute;
	height: 100%;
	top: 0;
	right: 0;
	background-color: var(--color-accent);
	transition: background-color 200ms ease-in-out, border-color 200ms ease-in-out, opacity 200ms ease-in-out;
}

.internal-embed.is-loaded:not(.embedded-part):has(.markdown-source-view):hover:before {
	width: 3px;
	transition: background-color 200ms ease-in-out, border-color 200ms ease-in-out, opacity 200ms ease-in-out;
}
```
