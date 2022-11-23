import * as React from 'react';
import { Tree } from "../../types/tree";
import { useEffect } from "react";
import { useBaseStore } from "../../store/baseStore";
import { TreeNS } from "../../utils/tree";
import { Cursor } from "../../utils/cursor";
import TreeChildren from "./TreeChildren";
import opml from "opml-generator";

interface Props {
    topBullet: boolean;
    node: Tree;
}

const TreeNode: React.FC<Props> = (props) => {
    const { topBullet, node } = props;

    const inputRef = React.useRef<HTMLInputElement>(null);
    const [mouseOver, setMouseOver] = React.useState(false);
    const [htmlContent, setHtmlContent] = React.useState('');

    const [className, setClassName] = React.useState('dot');
    const [contentClassName, setContentClassName] = React.useState('editable');
    const [plus, setPlus] = React.useState(false);

    const globalTree = useBaseStore((state) => state.globalTree);
    const globalTreeBak = useBaseStore((state) => state.globalTreeBak);
    const globalSkipFocus = useBaseStore((state) => state.globalSkipFocus);
    const globalCompletedHidden = useBaseStore((state) => state.globalCompletedHidden);
    const globalUndoRing = useBaseStore((state) => state.globalUndoRing);

    const setGloablSkipFocus = useBaseStore((state) => state.setGloablSkipFocus);
    const setGlobalDiffUncommitted = useBaseStore((state) => state.setGlobalDiffUncommitted);
    const setGlobalTree = useBaseStore((state) => state.setGlobalTree);
    const setSelected = useBaseStore((state) => state.setSelected);
    const setCaretLoc = useBaseStore((state) => state.setCaretLoc);
    const setGlobalRenderAllNoUndo = useBaseStore((state) => state.setGlobalRenderAllNoUndo);

    useEffect(() => {
        if (node.uuid === globalTree.selected) {
            const el = inputRef.current;
            setGloablSkipFocus(true);
            //console.log('focus on', this.props.node.title);
            el.focus();
            setGloablSkipFocus(false)
            Cursor.setCursorLoc(el[0], globalTree.caretLoc);
        }
        if (
            inputRef.current &&
            node.title !== inputRef.current.textContent
        ) {
            // Need this because of: http://stackoverflow.com/questions/22677931/react-js-onchange-event-for-contenteditable/27255103#27255103
            // An example he was mentioning is that the virtual dom thinks that the div is empty, but if
            // you type something and then press "clear", or specifically set the text, the VDOM will
            // think the two are the same.
            // This is necessary when doing undo/redo. Then we'll be explicitly setting the text of the DOM
            inputRef.current.textContent = node.title;
        }
    }, [node]);

    useEffect(() => {
        return () => {
            // Dot ClassName
            if (node.childNodes != null) {
                setClassName('dot togglable');
                if (node.collapsed) {
                    setClassName('dot togglable dot-collapsed');
                }
            }
        };
    }, []);

    useEffect(() => {
        return () => {
            // Content ClassName
            if (topBullet) {
                setContentClassName('editable topBullet');
            }
            if (node.title == 'special_root_title') {
                setContentClassName('editable topBullet display-none');
            }
            if (node.completed) {
                setContentClassName('editable topBullet display-none completed');
            }
        };
    }, [topBullet, node]);

    useEffect(() => {
        return () => {
            if (mouseOver) {
                setPlus(true);
            } else {
                setPlus(false);
            }
        };
    }, [mouseOver]);


    const handleChange = (event) => {
        const html = inputRef.current.textContent;
        if (html !== htmlContent) {
            setGlobalDiffUncommitted(true);
            const currentNode = TreeNS.findFromUUID(globalTree, node.uuid);
            currentNode.title = event.target.textContent;
            setCaretLoc(Cursor.getCaretCharacterOffsetWithin(
                inputRef.current
            ));
        } else {
            console.assert(
                false,
                'Why am I getting a change event if nothing changed?'
            );
        }
        setHtmlContent(html);
    }

    const handleClick = (event) => {
        if (globalSkipFocus) {
            return;
        }
        const currentNode = TreeNS.findFromUUID(globalTree, node.uuid);
        setSelected(currentNode.uuid);
        if (event.type === 'focus') {
            // clicking on the div, not the actual text. Also always fired when switching focus
            setCaretLoc(currentNode.title.length);
        } else {
            // clicking on the text directly
            setCaretLoc(Cursor.getCaretCharacterOffsetWithin(
                inputRef.current
            ));
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const KEYS = {
            LEFT: 'ArrowLeft',
            UP: 'ArrowUp',
            RIGHT: 'ArrowRight',
            DOWN: 'ArrowDown',
            ENTER: 'Enter',
            TAB: 'Tab',
            BACKSPACE: 'Backspace',
            Z: 'KeyZ',
            Y: 'KeyY',
            S: 'KeyS',
            C: 'KeyC',
            END: 'End',
            HOME: 'Home',
            SPACE: 'Space',
        };
        if (e.code === KEYS.LEFT) {
            if (e.ctrlKey) {
                setGlobalTree(TreeNS.zoomOutOne(globalTree));
                e.preventDefault();
            } else {
                const newCaretLoc = Cursor.getCaretCharacterOffsetWithin(
                    inputRef.current
                );
                if (newCaretLoc === 0) {
                    setGlobalTree(TreeNS.selectPreviousNode(globalTree));
                    const selected = TreeNS.findSelected(globalTree); // TODO could do this faster than two searches
                    setCaretLoc(selected.title.length);
                    e.preventDefault();
                } else {
                    setCaretLoc(newCaretLoc - 1);
                }
            }
        } else if (e.code === KEYS.END && e.ctrlKey) {
            setGlobalTree(TreeNS.selectLastNode(globalTree));
            e.preventDefault();
        } else if (e.code === KEYS.HOME && e.ctrlKey) {
            setGlobalTree(TreeNS.selectFirstNode(globalTree));
            e.preventDefault();
        } else if (e.code === KEYS.UP) {
            if (e.shiftKey && e.ctrlKey) {
                setGlobalTree(TreeNS.shiftUp(globalTree));
            } else {
                setGlobalTree(TreeNS.selectPreviousNode(globalTree));
                setCaretLoc(0);
            }
            e.preventDefault();
        } else if (e.code === KEYS.RIGHT) {
            if (e.ctrlKey) {
                const currentNode = TreeNS.findFromUUID(globalTree, node.uuid);
                setGlobalTree(TreeNS.zoom(currentNode));
                e.preventDefault();
            } else {
                const newCaretLoc = Cursor.getCaretCharacterOffsetWithin(
                    inputRef.current
                );
                if (newCaretLoc === inputRef.current.textContent.length) {
                    setGlobalTree(TreeNS.selectNextNode(globalTree));
                    setCaretLoc(0);
                    e.preventDefault();
                } else {
                    setCaretLoc(newCaretLoc + 1);
                }
            }
        } else if (e.code === KEYS.DOWN) {
            if (e.shiftKey && e.ctrlKey) {
                setGlobalTree(TreeNS.shiftDown(globalTree));
            } else {
                setGlobalTree(TreeNS.selectNextNode(globalTree));
                setCaretLoc(0);
            }
            e.preventDefault();
        } else if (e.code === KEYS.ENTER && e.ctrlKey) {
            setGlobalTree(TreeNS.completeCurrent(globalTree));
            e.preventDefault();
        } else if (e.code === KEYS.ENTER) {
            setCaretLoc(Cursor.getCaretCharacterOffsetWithin(
                inputRef.current
            ));
            setGlobalTree(TreeNS.newLineAtCursor(globalTree));
            e.preventDefault();
        } else if (e.code === KEYS.BACKSPACE) {
            if (e.ctrlKey && e.shiftKey) {
                setGlobalTree(TreeNS.deleteSelected(globalTree));
                e.preventDefault();
            } else {
                globalTree.caretLoc = Cursor.getCaretCharacterOffsetWithin(
                    inputRef.current
                );
                if (globalTree.caretLoc === 0) {
                    setGlobalTree(TreeNS.backspaceAtBeginning(globalTree));
                    e.preventDefault();
                }
            }
        } else if (e.code === KEYS.TAB) {
            if (e.shiftKey) {
                setGlobalTree(TreeNS.unindent(globalTree));
            } else {
                setGlobalTree(TreeNS.indent(globalTree));
            }
            e.preventDefault();
        } else if (e.code === KEYS.SPACE && e.ctrlKey) {
            setGlobalTree(TreeNS.collapseCurrent(globalTree));
            e.preventDefault();
        } else if (e.code === KEYS.Z && (e.ctrlKey || e.metaKey)) {
            setGlobalTree(TreeNS.clone(globalUndoRing.undo()));
            setGlobalRenderAllNoUndo();
            e.preventDefault();
        } else if (e.code === KEYS.Y && (e.ctrlKey || e.metaKey)) {
            setGlobalTree(TreeNS.clone(globalUndoRing.redo()));
            setGlobalRenderAllNoUndo();
            e.preventDefault();
        } else if (e.code === KEYS.S && e.ctrlKey) {
            window.prompt(
                'Copy to clipboard: Ctrl+C, Enter',
                JSON.stringify(TreeNS.cloneNoParentClean(globalTree), null, 4)
            );
            e.preventDefault();
        } else if (e.code === KEYS.C && e.ctrlKey) {
            const currentNode = TreeNS.findFromUUID(globalTree, node.uuid);
            const outlines = TreeNS.toOutline(currentNode);
            console.log(opml({}, [outlines]));
            e.preventDefault();
        } else {
            // console.log(e.keyCode);
        }
    }

    const toggle = () => {
        const currentNode = TreeNS.findFromUUID(globalTree, node.uuid);
        globalTree.selected = currentNode.uuid;
        setGlobalTree(TreeNS.collapseCurrent(globalTree));
    }

    const handleMouseOver = () => {
        setMouseOver(true);
    }

    const handleMouseOut = () => {
        setMouseOver(false);
    }

    const zoom = () => {
        const nodeTemp = TreeNS.findFromUUID(globalTree, node.uuid);
        setGlobalTree(TreeNS.zoom(nodeTemp));
        setSelected(nodeTemp.uuid);
    }


    return (
        (node.completed && globalCompletedHidden && !topBullet) ? null :
            <div className="node-wrapper" onMouseLeave={ handleMouseOut }>
                <div className="node-direct-wrapper">
                    {
                        (!topBullet) ?
                            <span
                                onClick={ zoom }
                                onMouseOver={ handleMouseOver }
                                className={ className }
                            >
                                        { String.fromCharCode(8226) }
                                    </span> : ''
                    }
                    <div className="plus-wrapper">
                        <div onClick={ toggle } className="collapseButton">
                            { plus ? '+' : '-' }
                        </div>
                    </div>
                    <div
                        className={ contentClassName }
                        contentEditable={ globalTreeBak ? false : true }
                        ref={ inputRef }
                        onKeyDown={ handleKeyDown }
                        onInput={ handleChange }
                        onFocus={ handleClick }
                        onClick={ handleClick }
                        dangerouslySetInnerHTML={ { __html: node.title } }
                    />
                </div>
                { (topBullet || !node.collapsed) ? <TreeChildren childNodes={ node.childNodes }/> : '' }
            </div>
    );
};

export default TreeNode;
