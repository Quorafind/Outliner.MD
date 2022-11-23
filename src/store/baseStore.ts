import create from 'zustand';
import { DiffMap, Tree } from '../types/tree';
import UndoRing from "../utils/undoRing";

interface BaseState {
    globalTree: Tree | null;
    globalTreeBak: Tree | null;
    globalParseTree: Tree | null;
    globalDataSaved: boolean;
    globalSkipFocus: boolean;
    globalCompletedHidden: boolean;
    globalDiffUncommitted: boolean;
    globalSkipNextUndo: boolean;
    globalRenderAllNoUndo: boolean;
    globalUndoRing: UndoRing | null;
    changeHiddenComplete: (hidden?: boolean) => void;
    setGlobalTree: (tree: Tree) => void;
    setGlobalTreeBak: (tree: Tree) => void;
    setGlobalParseTree: (tree: Tree) => void;
    setGloablSkipFocus: (skip: boolean) => void;
    setGlobalDiffUncommitted: (diff: boolean) => void;
    setGlobalSkipNextUndo: (skip: boolean) => void;
    setGlobalUndoRing: (undoRing: UndoRing | null) => void;
    setSelected: (uuid: string | null) => void;
    setDiff: (diff: DiffMap) => void;
    setCaretLoc: (caretLoc: number | null) => void;
    setGlobalRenderAllNoUndo: () => void;
}

export const useBaseStore = create<BaseState>((set) => ({
    globalTree: null,
    globalTreeBak: null,
    globalParseTree: null,
    globalDataSaved: true,
    globalSkipFocus: false,
    globalCompletedHidden: false,
    globalDiffUncommitted: false,
    globalSkipNextUndo: false,
    globalRenderAllNoUndo: false,
    globalUndoRing: null,
    changeHiddenComplete: (hidden?: boolean) => set((state) => ({ globalCompletedHidden: hidden ?? !state.globalCompletedHidden })),
    setGlobalTree: (tree: Tree | null) => set({ globalTree: tree }),
    setGlobalTreeBak: (tree: Tree | null) => set({ globalTreeBak: tree }),
    setGlobalParseTree: (tree: Tree | null) => set({ globalParseTree: tree }),
    setGloablSkipFocus: (skip: boolean) => set({ globalSkipFocus: skip }),
    setGlobalDiffUncommitted: (diff: boolean) => set({ globalDiffUncommitted: diff }),
    setGlobalSkipNextUndo: (skip: boolean) => set({ globalSkipNextUndo: skip }),
    setGlobalUndoRing: (ring: UndoRing | null) => set({ globalUndoRing: ring }),
    setSelected: (selected: string | null) =>
        set((state) => ({
            globalTree: {
                ...state.globalTree,
                selected: selected ? selected : null,
            },
        })),
    setDiff: (diff: DiffMap | null) =>
        set((state) => ({
            globalTree: {
                ...state.globalTree,
                diff: diff,
            },
        })),
    setCaretLoc: (caretLoc: number | null) =>
        set((state) => ({
            globalTree: {
                ...state.globalTree,
                caretLoc: caretLoc,
            },
        })),
    setGlobalRenderAllNoUndo: () => set((state) => ({ globalRenderAllNoUndo: !state.globalRenderAllNoUndo })),
}));
