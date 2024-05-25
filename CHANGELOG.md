# 0.1.4

## Shinny new things

- feat: when list item has mark content, for example (And if you press enter at the end of the line, the new bullet line
  should be added after the mark content.
  ):

```markdown
- Here is a bullet line
  Mark: this is a mark content
```

- feat: support copy link to text fragment. Resolves #34

## Fixes

- fix: conflict with `Obsidian Banner` plugin, cause paper-layout not working well. Resolves #41
- fix: height issue of Popout window. Resolves #39
- fix: conflict with `Obsidian Paste image rename` plugin. Resolves #43
- fix: when markdown link is embedded, the link should be rendered as a link. Resolves #49

# 0.1.3

## Breaking changes

- `Create inline embed` renamed as `Create link to embed text fragment`.
  About [Text fragment](https://developer.mozilla.org/en-US/docs/Web/Text_fragments)

## Shinny new things

- feat: support link to text fragment [docs](https://docs.outliner.md/pages/20240517232122); Resolves:  #25
- feat: click on link to jump to text fragment and highlight it. [docs](https://docs.outliner.md/pages/20240517232122)
  Resolves: #20
- style: settings to disable paper layout. Resolves #28 #27
- feat: click on backlink to jump back target pos. [docs](https://docs.outliner.md/pages/20240514151617) Resolves #29
- feat: block-id in embedded editor cannot be selected any more. [docs](https://docs.outliner.md/pages/20240517162521)
  Resolves #19

## Fixes

- editor: Embedded whole page in backlink should not be hidden when its content changed.
- editor: end mark of text fragment sometimes doesn't render correctly.
