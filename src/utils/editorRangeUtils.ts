import { Editor, App } from "obsidian";
import { KeepRangeVisible } from "../cm/KeepRangeVisible";
import { CalculateRangeForZooming } from "../cm/CalculateRangeForZooming";
import {
	zoomInEffect,
	zoomWithHideIndentEffect,
} from "../cm/VisibleRangeController";
import { hideFrontMatterEffect } from "../cm/VisibleRangeController";

/**
 * Represents a range with type information
 */
export interface TypedRange {
	from: number;
	to: number;
	type: "part" | "block" | "heading" | "whole";
}

/**
 * Base class for range operations
 */
export abstract class BaseRangeManager {
	protected calculateRangeForZooming: CalculateRangeForZooming;
	protected keepRangeVisible: KeepRangeVisible;

	constructor() {
		this.calculateRangeForZooming = new CalculateRangeForZooming();
		this.keepRangeVisible = new KeepRangeVisible();
	}

	/**
	 * Calculates the zoom range for a given position
	 */
	protected calculateZoomRange(
		editor: Editor,
		from: number
	): TypedRange | null {
		const result = this.calculateRangeForZooming.calculateRangeForZooming(
			editor.cm.state,
			from
		);
		return result ? { ...result, type: "block" as const } : null;
	}

	/**
	 * Gets the indent for a line
	 */
	protected getLineIndent(editor: Editor, position: number): string | null {
		const line = editor.cm.state.doc.lineAt(position);
		return line.text.match(/^\s*/)?.[0] || null;
	}
}

/**
 * Manages single range operations
 */
export class SingleRangeManager extends BaseRangeManager {
	updateVisibility(editor: Editor, range: TypedRange): void {
		if (range.type === "part") {
			this.updatePartRange(editor, range);
		} else {
			this.updateBlockRange(editor, range);
		}
	}

	private updatePartRange(editor: Editor, range: TypedRange): void {
		editor.cm.dispatch({
			effects: [
				zoomInEffect.of({
					from: range.from,
					to: range.to,
					type: "part",
				}),
			],
		});
	}

	private updateBlockRange(editor: Editor, range: TypedRange): void {
		const newRange = this.calculateZoomRange(editor, range.from);

		if (newRange) {
			editor.cm.dispatch({
				effects: [zoomInEffect.of(newRange)],
			});

			this.applyIndentHiding(editor, newRange);
		} else {
			editor.cm.dispatch({
				effects: [zoomInEffect.of(range)],
			});
		}
	}

	private applyIndentHiding(editor: Editor, range: TypedRange): void {
		const indent = this.getLineIndent(editor, range.from);
		if (indent) {
			editor.cm.dispatch({
				effects: zoomWithHideIndentEffect.of({
					range: {
						from: range.from,
						to: range.to,
					},
					indent,
				}),
			});
		}
	}
}

/**
 * Manages multiple range operations
 */
export class MultiRangeManager extends BaseRangeManager {
	/**
	 * Updates visibility for multiple ranges
	 */
	updateMultipleRanges(editor: Editor, ranges: TypedRange[]): void {
		const wholeRanges = ranges.map((r) => {
			const calculated = this.calculateZoomRange(editor, r.from);
			return calculated || r;
		});

		this.keepRangeVisible.keepRangesVisible(editor.cm, wholeRanges);

		for (const range of wholeRanges) {
			this.applyIndentHiding(editor, range);
		}
	}

	private applyIndentHiding(editor: Editor, range: TypedRange): void {
		const indent = this.getLineIndent(editor, range.from);
		if (indent) {
			editor.cm.dispatch({
				effects: zoomWithHideIndentEffect.of({
					range: {
						from: range.from,
						to: range.to,
					},
					indent,
				}),
			});
		}
	}
}

/**
 * Manages front matter visibility
 */
export class FrontMatterRangeManager {
	updateVisibility(editor: Editor, app: App, file: any): void {
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
}

/**
 * Factory for creating appropriate range managers
 */
export class RangeManagerFactory {
	static createSingleRangeManager(): SingleRangeManager {
		return new SingleRangeManager();
	}

	static createMultiRangeManager(): MultiRangeManager {
		return new MultiRangeManager();
	}

	static createFrontMatterManager(): FrontMatterRangeManager {
		return new FrontMatterRangeManager();
	}
}

/**
 * Legacy EditorRangeUtils class for backward compatibility
 * @deprecated Use specific range managers instead
 */
export class EditorRangeUtils {
	private singleRangeManager: SingleRangeManager;
	private multiRangeManager: MultiRangeManager;
	private frontMatterManager: FrontMatterRangeManager;

	constructor() {
		this.singleRangeManager =
			RangeManagerFactory.createSingleRangeManager();
		this.multiRangeManager = RangeManagerFactory.createMultiRangeManager();
		this.frontMatterManager =
			RangeManagerFactory.createFrontMatterManager();
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
		const typedRanges: TypedRange[] = ranges.map((r) => ({
			...r,
			type: "block" as const,
		}));
		this.multiRangeManager.updateMultipleRanges(editor, typedRanges);
	}

	/**
	 * Updates the visible range for a single range
	 */
	private updateVisibleRangeSingle(
		editor: Editor,
		range: { from: number; to: number },
		type: "part" | "block" | "heading"
	) {
		const typedRange: TypedRange = {
			...range,
			type,
		};
		this.singleRangeManager.updateVisibility(editor, typedRange);
	}

	/**
	 * Updates the indent visibility for a range
	 */
	updateIndentVisible(editor: Editor, range: { from: number; to: number }) {
		// Apply indent hiding directly using the single range manager's logic
		const indent = this.singleRangeManager["getLineIndent"](
			editor,
			range.from
		);
		if (indent) {
			editor.cm.dispatch({
				effects: zoomWithHideIndentEffect.of({
					range: {
						from: range.from,
						to: range.to,
					},
					indent,
				}),
			});
		}
	}

	/**
	 * Updates front matter visibility
	 */
	updateFrontMatterVisible(editor: Editor, app: App, file: any) {
		this.frontMatterManager.updateVisibility(editor, app, file);
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

/**
 * Modern range management utilities
 */
export class RangeUtils {
	private static singleRangeManager =
		RangeManagerFactory.createSingleRangeManager();
	private static multiRangeManager =
		RangeManagerFactory.createMultiRangeManager();
	private static frontMatterManager =
		RangeManagerFactory.createFrontMatterManager();

	/**
	 * Updates visibility for a single range
	 */
	static updateSingleRange(editor: Editor, range: TypedRange): void {
		this.singleRangeManager.updateVisibility(editor, range);
	}

	/**
	 * Updates visibility for multiple ranges
	 */
	static updateMultipleRanges(editor: Editor, ranges: TypedRange[]): void {
		this.multiRangeManager.updateMultipleRanges(editor, ranges);
	}

	/**
	 * Updates front matter visibility
	 */
	static updateFrontMatter(editor: Editor, app: App, file: any): void {
		this.frontMatterManager.updateVisibility(editor, app, file);
	}

	/**
	 * Creates a typed range from basic range data
	 */
	static createTypedRange(
		from: number,
		to: number,
		type: "part" | "block" | "heading" | "whole" = "block"
	): TypedRange {
		return { from, to, type };
	}
}

// Export a singleton instance for backward compatibility
export const editorRangeUtils = new EditorRangeUtils();

// Export the modern utilities as the preferred interface
export { RangeUtils as rangeUtils };
