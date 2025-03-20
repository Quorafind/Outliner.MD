import { Editor, App } from "obsidian";
import { KeepRangeVisible } from "../cm/KeepRangeVisible";
import { CalculateRangeForZooming } from "../cm/CalculateRangeForZooming";
import {
	zoomInEffect,
	zoomWithHideIndentEffect,
} from "../cm/VisibleRangeController";
import { hideFrontMatterEffect } from "../cm/VisibleRangeController";

/**
 * Common utilities for editor range operations
 */

export class EditorRangeUtils {
	private calculateRangeForZooming: CalculateRangeForZooming;
	private keepRangeVisible: KeepRangeVisible;

	constructor() {
		this.calculateRangeForZooming = new CalculateRangeForZooming();
		this.keepRangeVisible = new KeepRangeVisible();
	}

	/**
	 * Updates the visible range of an editor
	 */
	updateVisibleRange(
		editor: Editor,
		range: { from: number; to: number } | { from: number; to: number }[],
		type: "part" | "block" | "heading" = "block"
	) {
		if (Array.isArray(range)) {
			this.updateVisibleRangeArray(editor, range);
		} else {
			this.updateVisibleRangeSingle(editor, range, type);
		}
	}

	/**
	 * Updates the visible range for multiple ranges
	 */
	private updateVisibleRangeArray(
		editor: Editor,
		ranges: { from: number; to: number }[]
	) {
		const wholeRanges = ranges.map((r) => {
			return (
				this.calculateRangeForZooming.calculateRangeForZooming(
					editor.cm.state,
					r.from
				) || {
					from: r.from,
					to: r.to,
				}
			);
		});

		this.keepRangeVisible.keepRangesVisible(editor.cm, wholeRanges);

		for (const r of wholeRanges) {
			const firstLine = editor.cm.state.doc.lineAt(r.from);
			const firstLineIndent = firstLine.text.match(/^\s*/)?.[0];

			if (firstLineIndent) {
				editor.cm.dispatch({
					effects: zoomWithHideIndentEffect.of({
						range: {
							from: r.from,
							to: r.to,
						},
						indent: firstLineIndent,
					}),
				});
			}
		}
	}

	/**
	 * Updates the visible range for a single range
	 */
	private updateVisibleRangeSingle(
		editor: Editor,
		range: { from: number; to: number },
		type: "part" | "block" | "heading"
	) {
		if (type === "part") {
			editor.cm.dispatch({
				effects: [
					zoomInEffect.of({
						from: range.from,
						to: range.to,
						type: "part",
					}),
				],
			});
			return;
		}

		const newRange = this.calculateRangeForZooming.calculateRangeForZooming(
			editor.cm.state,
			range.from
		);

		if (newRange) {
			editor.cm.dispatch({
				effects: [zoomInEffect.of(newRange)],
			});

			const firstLine = editor.cm.state.doc.lineAt(newRange.from);
			const firstLineIndent = firstLine.text.match(/^\s*/)?.[0];

			if (firstLineIndent) {
				editor.cm.dispatch({
					effects: zoomWithHideIndentEffect.of({
						range: {
							from: newRange.from,
							to: newRange.to,
						},
						indent: firstLineIndent,
					}),
				});
			}
		} else {
			editor.cm.dispatch({
				effects: [zoomInEffect.of(range)],
			});
		}
	}

	/**
	 * Updates the indent visibility for a range
	 */
	updateIndentVisible(editor: Editor, range: { from: number; to: number }) {
		const firstLine = editor.cm.state.doc.lineAt(range.from);
		const firstLineIndent = firstLine.text.match(/^\s*/)?.[0];

		if (firstLineIndent) {
			editor.cm.dispatch({
				effects: zoomWithHideIndentEffect.of({
					range: {
						from: range.from,
						to: range.to,
					},
					indent: firstLineIndent,
				}),
			});
		}
	}

	/**
	 * Updates front matter visibility
	 */
	updateFrontMatterVisible(editor: Editor, app: App, file: any) {
		const cache = app.metadataCache.getFileCache(file);
		const frontMatter = cache?.frontmatterPosition;

		if (frontMatter) {
			editor.cm.dispatch({
				effects: hideFrontMatterEffect.of({
					range: {
						from: frontMatter.start.offset,
						to: frontMatter.end.offset,
					},
				}),
			});
		}
	}

	/**
	 * Calculates the range for a file based on subpath
	 */
	getRange(
		app: App,
		targetFile: any,
		subpath?: string,
		targetRange?: { from: number; to: number },
		data?: string
	) {
		const cache = app.metadataCache.getFileCache(targetFile);

		if (!subpath && targetRange) {
			return {
				from: targetRange.from,
				to: targetRange.to,
				type: "part",
			};
		}

		let targetRangeResult = {
			from: 0,
			to: data?.length || 0,
			type: "whole",
		};

		if (cache && subpath) {
			if (/#\^/.test(subpath)) {
				const id = subpath.slice(2);
				const block = Object.values(cache?.blocks || {}).find((key) => {
					return key.id === id;
				});

				if (block) {
					targetRangeResult = {
						from: block.position?.start.offset,
						to: block.position?.end.offset,
						type: "block",
					};
				}

				return targetRangeResult;
			} else if (/^#/.test(subpath)) {
				const heading = subpath.slice(1);
				const headingBlock = Object.values(cache?.headings || {}).find(
					(key) => {
						return (
							heading.trim() &&
							key.heading
								.replace(/((\[\[)|(\]\]))/g, "")
								.trim() === heading.trim()
						);
					}
				);

				if (headingBlock) {
					targetRangeResult = {
						from: headingBlock.position.start.offset,
						to: headingBlock.position.end.offset,
						type: "heading",
					};
				}

				return targetRangeResult;
			}
		}

		return targetRangeResult;
	}
}

// Export a singleton instance for convenience
export const editorRangeUtils = new EditorRangeUtils();
