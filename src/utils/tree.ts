import { Option, Tree } from '../types/tree';

export namespace TreeNS {
    export const generateUUID = function () {
        let d = new Date().getTime();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
    };

    // getAllChildren = function(tree) {
    // 	const ret = [];
    // 	console.log('get all children of', tree.title);
    // 	const toProcess = tree.childNodes.map(function (x) {return x;});
    // 	while (toProcess.length > 0) {
    // 		console.log('popping of', toProcess);
    // 		const node = toProcess.pop();
    // 		console.log('pushing', node.title);
    // 		ret.push(node);
    // 		toProcess = toProcess.concat(node.childNodes.map(function (x) {return x;}));
    // 	}
    // 	console.log('all children is', ret.map(function (n) { return n.title; }));
    // 	return ret;
    // }

    export const addDiff = function (node: Tree) {
        // TODO, speed this up too...
        const chain = getParentChain(node);
        const root = getRoot(node);
        chain.forEach(function (n) {
            root.diff[n.uuid] = true;
        });
    };

    export const addAllDiff = function (node: Tree) {
        const root = getRoot(node);
        root.diff['run_full_diff'] = true;
    };

    export const getParentChain = function (node: Tree) {
        const ret = [];
        while (node.title !== 'special_root_title') {
            ret.push(node);
            node = node.parent;
        }
        ret.push(node);
        return ret;
    };

    export const selectNextNode = function (tree: Tree) {
        const selected = findSelected(tree);
        const root = getRoot(tree);
        const next = findNextNode(selected);
        if (next) {
            root.selected = next.uuid;
            addDiff(next);
        }
    };

    export const selectPreviousNode = function (tree: Tree) {
        const selected = findSelected(tree);
        const root = getRoot(tree);
        const previous = findPreviousNode(selected);
        if (previous) {
            root.selected = previous.uuid;
            addDiff(previous);
        }
    };

    // TODO shouldn't this be the last node of the current zoom?
    export const selectLastNode = function (tree: Tree) {
        const root = getRoot(tree);
        const last = findDeepest(root.zoom.childNodes[root.zoom.childNodes.length - 1]);
        root.selected = last.uuid;
        root.caretLoc = last.title.length;
    };

    export const selectFirstNode = function (tree: Tree) {
        const root = getRoot(tree);
        root.selected = root.zoom.uuid;
        root.caretLoc = 0;
    };

    export const appendSibling = function (tree, title) {
        let i;
        for (i = 0; i < tree.parent.childNodes.length; i++) {
            if (tree.parent.childNodes[i] == tree) {
                break;
            }
        }
        const ret = makeNode({ title: title, parent: tree.parent });
        addUUIDPointer(ret);
        tree.parent.childNodes.splice(i + 1, 0, ret);
        addDiff(tree.parent);
        return ret;
    };

    export const newChildAtCursor = function (selected: Tree) {
        const ret = makeNode({ title: '', parent: selected });
        addDiff(selected.parent);
        addDiff(selected);
        addDiff(ret);
        const root = getRoot(selected);
        addUUIDPointer(ret);
        if (selected.childNodes) {
            selected.childNodes.unshift(ret);
        } else {
            selected.childNodes = [ret];
        }
        root.selected = ret.uuid;
        root.caretLoc = 0;
    };

    export const newLineAtCursor = function (tree: Tree) {
        const selected = findSelected(tree);
        const root = getRoot(tree);
        const textStart = selected.title.substr(0, root.caretLoc);
        const textRest = selected.title.substr(root.caretLoc);
        if (selected === root.zoom || (textRest.length === 0 && selected.childNodes.length > 0 && !selected.collapsed)) {
            newChildAtCursor(selected);
        } else {
            selected.title = textStart;
            const nextNode = appendSibling(selected, textRest);
            addDiff(nextNode);
            addDiff(selected);
            if (textRest.length > 0) {
                setChildNodes(nextNode, selected.childNodes);
                setChildNodes(selected, []);
                if (selected.collapsed) {
                    nextNode.collapsed = true;
                    delete selected.collapsed;
                }
            }
            if (textStart.length > 0 || (textStart.length === 0 && textRest.length === 0)) {
                root.selected = nextNode.uuid;
            }
            root.caretLoc = 0;
        }
    };

    export const addUUIDPointer = function (tree: Tree) {
        const root = getRoot(tree);
        root.uuidMap[tree.uuid] = tree;
    };

    export const addUUIDPointers = function (tree: Tree) {
        addUUIDPointer(tree);
        tree.childNodes.map(function (child) {
            addUUIDPointers(child);
        });
    };

    export const findFromUUID = function (tree: Tree, uuid: string) {
        const root = getRoot(tree);
        return root.uuidMap[uuid];
    };

    export const setIfReal = function (toObj: any, fromObj: any, property: string, defaultVal?: any) {
        if (fromObj[property] === undefined) {
            if (defaultVal !== undefined) {
                toObj[property] = defaultVal;
            }
            return;
        }
        toObj[property] = fromObj[property];
    };

    export const makeNode = function (args, options?: Option): any {
        const ret = {};
        setIfReal(ret, args, 'title');
        setIfReal(ret, args, 'childNodes', []);
        setIfReal(ret, args, 'parent');
        setIfReal(ret, args, 'selected');
        setIfReal(ret, args, 'collapsed');
        setIfReal(ret, args, 'completed');
        setIfReal(ret, args, 'completedHidden');
        setIfReal(ret, args, 'caretLoc');
        setIfReal(ret, args, 'uuid', generateUUID());
        setIfReal(ret, args, 'uuidMap');
        setIfReal(ret, args, 'zoom');
        setIfReal(ret, args, 'diff');
        return ret;
    };

    export const clone = function (tree: Tree): Tree {
        // TODO this only really makes sense to use this clone for root stuff (see addUUIDPointers).. let's call it something else?
        const ret = cloneGeneral(tree, null, { noparent: false, nomouse: false });
        addUUIDPointers(ret);
        if (tree.zoom) {
            // TODO should be an inconstiant
            const root = getRoot(ret);
            ret.zoom = root.uuidMap[tree.zoomUUID];
        }
        return ret;
    };

    export const cloneNoParent = function (tree: Tree): Tree {
        return cloneGeneral(tree, null, { noparent: true, nomouse: false });
    };

    export const cloneNoParentNoCursor = function (tree): Tree {
        return cloneGeneral(tree, null, { noparent: true, nomouse: true });
    };

    export const cloneNoParentClean = function (tree): Tree {
        return cloneGeneral(tree, null, {
            noparent: true,
            nomouse: false,
            clean: true,
        });
    };

    export const cloneGeneral = function (tree: Tree, parent: Tree, options: Option): Tree {
        const me = makeNode(
            {
                title: tree.title,
                parent: options.noparent ? undefined : parent,
                selected: options.nomouse ? undefined : tree.selected,
                collapsed: tree.collapsed,
                completed: tree.completed,
                caretLoc: options.nomouse ? undefined : tree.caretLoc,
                uuid: tree.uuid,
                uuidMap: options.noparent ? undefined : {},
                completedHidden: tree.completedHidden,
                diff: options.noparent ? undefined : {},
            },
            { clean: options.clean },
        );
        if (tree.childNodes && tree.childNodes.length > 0) {
            me.childNodes = tree.childNodes.map(function (node) {
                return cloneGeneral(node, me, options);
            });
        } else if (options.clean) {
            me.childNodes = undefined;
        }
        me.zoomUUID = tree.zoomUUID;
        return me;
    };

    export const indent = function (tree: Tree) {
        const selected = findSelected(tree);
        const childNum = findChildNum(selected);
        if (childNum == 0) {
            return;
        }
        const newParent = selected.parent.childNodes[childNum - 1];
        delete newParent.collapsed;
        newParent.childNodes.push(selected);
        selected.parent.childNodes.splice(childNum, 1);
        selected.parent = newParent;
        // TODO diff is oldParent + newParent + selected + children of selected
        addAllDiff(selected);
    };

    export const unindent = function (tree: Tree) {
        const selected = findSelected(tree);
        const root = getRoot(tree);
        if (!selected.parent.parent) {
            return;
        }
        if (selected === root.zoom || selected.parent === root.zoom) {
            return;
        }
        const childNum = findChildNum(selected);
        const parentChildNum = findChildNum(selected.parent);
        const newParent = selected.parent.parent;
        newParent.childNodes.splice(parentChildNum + 1, 0, selected);
        selected.parent.childNodes.splice(childNum, 1);
        selected.parent = newParent;
        // TODO diff is oldParent + newParent + selected + children of selected
        addAllDiff(selected);
    };

    export const shiftUp = function (tree: Tree) {
        const selected = findSelected(tree);
        const childNum = findChildNum(selected);
        const parent = selected.parent;
        if (childNum == 0) {
            return;
        }
        if (parent.childNodes.length <= 1) {
            return;
        }
        const tmp = parent.childNodes[childNum];
        parent.childNodes[childNum] = parent.childNodes[childNum - 1];
        parent.childNodes[childNum - 1] = tmp;
        addDiff(parent);
    };

    export const shiftDown = function (tree: Tree) {
        const selected = findSelected(tree);
        const childNum = findChildNum(selected);
        const parent = selected.parent;
        if (childNum == parent.childNodes.length - 1) {
            return;
        }
        if (parent.childNodes.length <= 1) {
            return;
        }
        const tmp = parent.childNodes[childNum];
        parent.childNodes[childNum] = parent.childNodes[childNum + 1];
        parent.childNodes[childNum + 1] = tmp;
        addDiff(parent);
    };

    export const findChildNum = function (tree) {
        let i;
        for (i = 0; i < tree.parent.childNodes.length; i++) {
            if (tree.parent.childNodes[i] == tree) {
                return i;
            }
        }
        console.assert(false);
    };

    export const getRoot = function (tree: Tree) {
        if (tree.title === 'special_root_title') {
            return tree;
        }
        return getRoot(tree.parent);
    };

    export const getBreadcrumb = function (root: Tree) {
        if (root.zoom.title === 'special_root_title') {
            return [];
        }
        const ret = getBreadcrumbInner(root.zoom.parent);
        ret.unshift('Home');
        return ret;
    };

    export const getBreadcrumbInner = function (tree: Tree) {
        if (tree.title === 'special_root_title') {
            return [];
        }
        const ret = getBreadcrumbInner(tree.parent);
        ret.push(tree.title);
        return ret;
    };

    export const zoom = function (tree: Tree) {
        if (!tree) {
            console.log('cannot zoom that high!');
            return;
        }
        const root = getRoot(tree);
        root.zoom = tree;
        root.zoomUUID = tree.uuid;
        addAllDiff(root);
    };

    export const zoomOutOne = function (tree: Tree) {
        const root = getRoot(tree);
        if (root.zoom) {
            if (root.zoom.parent) {
                root.selected = root.zoom.uuid;
                root.caretLoc = 0;
                zoom(root.zoom.parent);
            }
        } else {
            // TODO ever get hit?
            console.assert(false, 'something wrong');
        }
        addAllDiff(root);
    };

    export const deleteSelected = function (tree: Tree) {
        // TODO think if this is the root..
        const selected = findSelected(tree);
        let nextSelection = findPreviousNode(selected);
        const root = getRoot(tree);
        if (!nextSelection) {
            console.assert(selected.parent.title === 'special_root_title');
            if (selected.parent.childNodes.length > 1) {
                nextSelection = selected.parent.childNodes[1];
            } else {
                selected.title = '';
                selected.childNodes = [];
                root.caretLoc = 0;
                delete selected.collapsed;
                delete selected.completed; // TODO do I want this?
                // No speed concern here, because this happens when the workflowy document is fully empty
                addAllDiff(root);
                return;
            }
        }
        const childNum = findChildNum(selected);
        selected.parent.childNodes.splice(childNum, 1);
        root.selected = nextSelection.uuid;
        root.caretLoc = nextSelection.title.length;
        addDiff(selected.parent);
        addDiff(nextSelection);
    };

    export const backspaceAtBeginning = function (tree: Tree) {
        // TODO think if this is the root
        const selected = findSelected(tree);
        const root = getRoot(tree);
        if (root.caretLoc !== 0) {
            console.log('TODO: home/end keys do not update caretLoc, and so this inconstiant fails');
        }
        const previous = findPreviousNode(selected);
        if (!previous || previous === selected.parent) {
            if (selected.title.length === 0) {
                deleteSelected(tree);
            }
            return;
        }
        // If the previous node is collapsed, it would be confusing to allow a "backspaceAtBeginning" to happen.
        if (!previous.collapsed) {
            const childNum = findChildNum(selected);
            selected.parent.childNodes.splice(childNum, 1);
            const root = getRoot(tree);
            root.selected = previous.uuid;
            root.caretLoc = previous.title.length;
            previous.title += selected.title;
            setChildNodes(previous, selected.childNodes);
            previous.collapsed = selected.collapsed;
        } else if (selected.title.length === 0) {
            deleteSelected(tree);
        }
        addDiff(selected.parent);
        addDiff(previous);
    };

    export const setChildNodes = function (tree: Tree, childNodes: Tree[]) {
        // TODO is there a way to stop anyone from explicitly setting childNodes?
        // We want that because if anyone ever sets childNodes, they should also set the parent
        // of the children
        // Or is there a way to have implicit parents?
        tree.childNodes = childNodes;
        for (let i = 0; i < childNodes.length; i++) {
            childNodes[i].parent = tree;
        }
    };

    export const findDeepest = function (tree: Tree) {
        const completedHidden = isCompletedHidden(tree);
        if (tree.childNodes && !tree.collapsed) {
            for (let i = tree.childNodes.length - 1; i >= 0; i--) {
                if (!completedHidden || !tree.childNodes[i].completed) {
                    return findDeepest(tree.childNodes[i]);
                }
            }
        }
        return tree;
    };

    export const findSelected = function (node: Tree) {
        const root = getRoot(node);
        console.assert(root === node);
        if (!root.selected) {
            return null;
        }
        return root.uuidMap[root.selected];
    };

    export const collapseCurrent = function (tree: Tree) {
        const selected = findSelected(tree);
        if (selected.childNodes && selected.childNodes.length > 0) {
            selected.collapsed = !selected.collapsed;
        }
        addAllDiff(selected);
    };

    export const countVisibleChildren = function (tree: Tree) {
        return tree.childNodes.filter(function (n) {
            return !n.completed;
        }).length;
    };

    export const completeCurrent = function (tree: Tree) {
        const selected = findSelected(tree);
        const root = getRoot(tree);
        if (root.zoom === selected) {
            return;
        }
        if (!selected.completed && selected.parent.title === 'special_root_title') {
            if (countVisibleChildren(selected.parent) <= 1) {
                return; // Can't select the only element left on the page..
            } else if (findChildNum(selected) === 0) {
                selected.completed = true;
                const backup = isCompletedHidden(tree);
                setCompletedHidden(tree, true);
                const next = findNextNode(selected.parent);
                setCompletedHidden(tree, backup);
                root.selected = next.uuid;
                return;
            }
        }
        selected.completed = !selected.completed;

        // Make sure to get off the current node. Particularly necessary if completion turns the node hidden.
        if (selected.completed) {
            const backup = isCompletedHidden(tree);
            selectPreviousNode(tree);
            setCompletedHidden(tree, true);
            selectNextNode(tree);
            setCompletedHidden(tree, backup);
        }
        addAllDiff(selected);
    };

    export const findPreviousNode = function (tree: Tree) {
        if (!tree || !tree.parent) {
            return null;
        }
        const root = getRoot(tree);
        if (root.zoom === tree) {
            return;
        }
        const completedHidden = isCompletedHidden(tree);
        for (let childNum = findChildNum(tree) - 1; childNum >= 0; childNum--) {
            if (!completedHidden || !tree.parent.childNodes[childNum].completed) {
                return findDeepest(tree.parent.childNodes[childNum]);
            }
        }

        if (tree.parent.title === 'special_root_title') {
            return null;
        }
        return tree.parent;
    };

    export const findNextNode = function (tree: Tree) {
        const root = getRoot(tree);
        const completedHidden = isCompletedHidden(tree);
        if (tree.childNodes && tree.childNodes.length > 0 && (!tree.collapsed || root.zoom === tree)) {
            for (let i = 0; i < tree.childNodes.length; i++) {
                if (!completedHidden || !tree.childNodes[i].completed) {
                    return tree.childNodes[i];
                }
            }
        }
        return findNextNodeRec(tree, root.zoom);
    };

    export const findNextNodeRec = function (tree: Tree, zoom: Tree) {
        if (!tree || !tree.parent) {
            return null;
        }
        if (tree === zoom) {
            return null;
        }
        const completedHidden = isCompletedHidden(tree);
        for (let childNum = findChildNum(tree) + 1; childNum < tree.parent.childNodes.length; childNum++) {
            if (!completedHidden || !tree.parent.childNodes[childNum].completed) {
                return tree.parent.childNodes[childNum];
            }
        }
        return findNextNodeRec(tree.parent, zoom);
    };

    export const makeTree = function (nodes?: Tree[]) {
        let ret: Tree = { title: 'special_root_title', parent: null, childNodes: nodes };
        ret = clone(ret);
        ret.zoom = ret;
        ret.zoomUUID = ret.uuid;
        ret.diff = {};
        ret.completedHidden = true;
        //ret.selected = ret.childNodes[0].uuid; // TODO check if needed?
        return ret;
    };

    export const makeDefaultTree = function (): Tree {
        const rawStartTree = [
            {
                title: 'goody',
                childNodes: [
                    { title: 'billy' },
                    {
                        title: 'suzie',
                        childNodes: [
                            {
                                title: 'puppy',
                                childNodes: [{ title: 'dog house' }],
                            },
                            { title: 'cherry thing' },
                        ],
                    },
                ],
            },
        ];
        rawStartTree.push({ title: 'the end', childNodes: undefined });
        const ret = makeTree(rawStartTree);
        return ret;
    };

    export const findFromIndexer = function (tree: Tree, indexer) {
        if (indexer.length <= 1) {
            return tree;
        }
        const parts = indexer.substr(1).split('-');
        for (let i = 0; i < parts.length; i++) {
            tree = tree.childNodes[parts[i]];
        }
        return tree;
    };

    export const toString = function (tree: Tree) {
        tree = cloneNoParent(tree);
        return JSON.stringify(tree);
    };

    export const toStringPretty = function (tree: Tree) {
        tree = cloneNoParent(tree);
        return JSON.stringify(tree, null, 2);
    };

    export const toStringClean = function (tree: Tree) {
        tree = cloneNoParentClean(tree);
        return JSON.stringify(tree);
    };

    export const fromString = function (s) {
        const obj = JSON.parse(s);
        const ret = clone(obj);
        if (!ret.zoomUUID) {
            ret.zoom = ret;
        } else {
            ret.zoom = ret.uuidMap[ret.zoomUUID];
        }
        return ret;
    };

    export const equals = function (one: Tree, two: Tree) {
        return toString(one) === toString(two);
    };

    export const toOutline = function (tree: Tree) {
        const ret = {
            text: tree.title,
            _children: tree.childNodes.map(function (node) {
                return toOutline(node);
            }),
        };

        return ret;
    };

    export const setCompletedHidden = function (tree: Tree, isHidden: boolean) {
        const root = getRoot(tree);
        // TODO or assert (tree == root)
        root.completedHidden = isHidden;
    };

    export const isCompletedHidden = function (tree: Tree) {
        const root = getRoot(tree);
        return root.completedHidden;
    };

    export const recSearch = function (tree: Tree, query: string) {
        const newTree = { title: tree.title, childNodes: [] };
        for (let i = 0; i < tree.childNodes.length; i++) {
            if (recSearch(tree.childNodes[i], query)) {
                //console.log('push on', tree.childNodes[i].title);
                newTree.childNodes.push(recSearch(tree.childNodes[i], query));
            }
        }
        if (newTree.childNodes.length === 0) {
            if (tree.title.indexOf(query) > -1) {
                //console.log('yeahh', tree.title, query);
                return { title: tree.title, childNodes: [] };
            }
            return null;
        }
        return newTree;
    };

    export const search = function (tree: Tree, query): Tree {
        const ret = recSearch(tree, query);
        if (ret) {
            return makeTree(ret.childNodes);
        }
        return makeTree();
    };

    export const yamlObjToTree = function (obj) {
        const ret = [];
        for (let i = 0; i < obj.length; i++) {
            if (obj[i + 1] instanceof Array) {
                ret.push({ title: obj[i], childNodes: yamlObjToTree(obj[i + 1]) });
                i += 1;
            } else if (typeof obj[i] === 'object' && obj[i].hasOwnProperty('title')) {
                ret.push(obj[i]);
            } else {
                ret.push({ title: obj[i] });
            }
        }
        return ret;
    };
}
