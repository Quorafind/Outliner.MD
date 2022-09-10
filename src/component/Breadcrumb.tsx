import React from 'react';
import { TreeNS } from '../utils/tree';
import { Tree } from "../types/tree";

interface Props {
    node: Tree;
}

const Breadcrumb: React.FC<Props> = (props: Props) => {
    function breadcrumbToText(titles: string[]) {
        if (titles.length > 0) {
            return titles.join(' > ') + ' >';
        }
        return '';
    }

    return (
        <div>
            <span className="breadcrumb">{ breadcrumbToText(TreeNS.getBreadcrumb(props.node)) }</span>
            <hr/>
        </div>
    );
};

export default Breadcrumb;
