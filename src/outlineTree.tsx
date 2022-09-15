import * as React from 'react';
import SearchBox from './component/SearchBox';
import ResetBtn from './component/ResetBtn';
import Breadcrumb from './component/Breadcrumb';
import DataSavedBtn from './component/DataSavedBtn';
import CompleteHiddenBtn from './component/CompleteHiddenBtn';
import TreeNode from "./component/tree/TreeNode";
import { useBaseStore } from "./store/baseStore";
import { useEffect } from "react";
import UndoRing from "./utils/undoRing";
import { TreeNS } from "./utils/tree";
import Only from './utils/commons/OnlyWhen';

interface Props {
}

const OutlineTree: React.FC<Props> = (): JSX.Element => {
    const globalTree = useBaseStore((state) => state.globalTree);
    const globalSkipNextUndo = useBaseStore((state) => state.globalSkipNextUndo);
    const globalUndoRing = useBaseStore((state) => state.globalUndoRing);
    const globalRenderAllNoUndo = useBaseStore((state) => state.globalRenderAllNoUndo);
    const globalDiffUncommitted = useBaseStore((state) => state.globalDiffUncommitted);

    const changeHiddenComplete = useBaseStore((state) => state.changeHiddenComplete);
    const setGlobalDiffUncommitted = useBaseStore((state) => state.setGlobalDiffUncommitted);
    const setGlobalSkipNextUndo = useBaseStore((state) => state.setGlobalSkipNextUndo);
    const setGlobalTree = useBaseStore((state) => state.setGlobalTree);
    const setGlobalParseTree = useBaseStore((state) => state.setGlobalParseTree);
    const setDiff = useBaseStore((state) => state.setDiff);
    const setGlobalUndoRing = useBaseStore((state) => state.setGlobalUndoRing);

    useEffect(() => {
        console.log("Hellow");
        if (globalTree) return;

        const tempTree = TreeNS.makeDefaultTree();
        setGlobalTree(tempTree);
        changeHiddenComplete(TreeNS.isCompletedHidden(tempTree));
        setGlobalParseTree(tempTree);
        const newTree = TreeNS.clone(tempTree);
        setGlobalUndoRing(new UndoRing(newTree, 50)); // TODO un hardcode
    }, []);

    useEffect(() => {
        if (globalDiffUncommitted) {
            setGlobalDiffUncommitted(false);
            const newTree = TreeNS.clone(globalTree);
            globalUndoRing.addPending(newTree);
            globalUndoRing.commit();
        }
    }, [globalDiffUncommitted]);


    useEffect(() => {
        if (!globalTree) return;
        const tempGlobalTree = globalTree;
        tempGlobalTree.diff['run_full_diff'] = true;
        setDiff(tempGlobalTree.diff);
        setGlobalSkipNextUndo(true);
    }, [globalRenderAllNoUndo]);


    useEffect(() => {
        if (!globalTree) return;

        if (globalSkipNextUndo) {
            setGlobalSkipNextUndo(false);
        } else if (Object.keys(globalTree.diff).length > 0) {
            setGlobalDiffUncommitted(true);
        }
        setDiff({});
    }, [globalSkipNextUndo]);


    return (
        <Only when={ globalTree?.zoom !== undefined }>
            <div>
                <div className="header">
                    <span className="logo">Bearings</span>
                    <SearchBox/>
                    <div className="header-buttons">
                        <ResetBtn/>
                        <a href="import.html">Import</a>
                        <DataSavedBtn/>
                        <CompleteHiddenBtn/>
                    </div>
                    { ' ' }
                </div>
                <div className="pad-wrapper">
                    <div className="breadcrumbs-wrapper">
                        <Breadcrumb node={ globalTree }/>
                    </div>
                    <TreeNode topBullet={ true } node={ globalTree?.zoom }/>
                </div>
            </div>
        </Only>
    );
};

export default OutlineTree;
