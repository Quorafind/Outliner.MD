import * as React from 'react';
import SearchBox from './component/SearchBox';
import ResetBtn from './component/ResetBtn';
import Breadcrumb from './component/Breadcrumb';
import DataSavedBtn from './component/DataSavedBtn';
import CompleteHiddenBtn from './component/CompleteHiddenBtn';

interface Props {
}

const OutlinerViewApp: React.FC<Props> = (props: Props): JSX.Element => {
    return (
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
                    <Breadcrumb node={ this.props.tree }/>
                </div>
                <ReactTree.TreeNode topBullet={ true } node={ this.props.tree.zoom }/>
            </div>
        </div>
    );
};

export default OutlinerViewApp;
