import React from 'react';
import PropTypes from 'prop-types';

Breadcrumb.propTypes = {};

const Breadcrumb = (props) => {
  function breadcrumbToText(titles: string[]) {
    if (titles.length > 0) {
      return titles.join(' > ') + ' >';
    }
    return '';
  }

  return (
    <div>
      <span className="breadcrumb">{breadcrumbToText(Tree.getBreadcrumb(props.node))}</span>
      <hr />
    </div>
  );
};

export default Breadcrumb;
