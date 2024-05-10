## Outliner View

> You need to install `Obsidian Zoom`, `Obsidian Outliner` and also `Obsidian Dataview` plugins to use this plugin better.

> [!warning]
> You need to add `outliner: true` to the frontmatter of the note to enable the outliner view.

1. Support basic filter features like workflowy.
2. Support bullet list menu;
3. Improve the experience of the outliner view;

### Roadmap

- Support fully outliner support;
  - Drag and drop;
  - Keyboard shortcuts;
  - Custom task group;
  - Better selection;
- [x] Support fully embed content editing;
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
