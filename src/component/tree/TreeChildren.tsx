import * as React from 'react';
import TreeNode from "./TreeNode";
import { Tree } from "../../types/tree";

interface Props {
    style?: React.CSSProperties;
    childNodes: Tree[];
}

const TreeChildren: React.FC<Props> = (props) => {
    const { childNodes, style } = props;
    let childNodeJSX;
    if (childNodes != null) {
        childNodeJSX = childNodes.map((node) => {
            return (
                <li key={ node.uuid }>
                    <TreeNode topBullet={ false } node={ node }/>
                </li>
            );
        });
    }

    return (<ul style={ style }>{ childNodeJSX }</ul>);
};

export default TreeChildren;
