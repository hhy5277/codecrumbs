import * as d3FlexTree from 'd3-flextree';

import { FILE_NODE_TYPE, DIR_NODE_TYPE, FOLDER_OPEN_STATE } from 'core/constants';
import { LAYOUT_CONFIG } from 'components/treeDiagram/component/constants';

export const getTreeLayout = (
  treeData,
  {
    includeFileChildren,
    extraSpaceForDetails,
    config = LAYOUT_CONFIG,
    openedFolders,
    activeItemsMap,
    activeCodeCrumbs
  }
) => {
  const layoutStructure = d3FlexTree.flextree({
    children: data => {
      if (data.type === DIR_NODE_TYPE) {
        if (openedFolders[data.path] === FOLDER_OPEN_STATE.CLOSED) {
          return [];
        }

        const children =
          openedFolders[data.path] === FOLDER_OPEN_STATE.OPEN_ACTIVE_CHILDREN_ONLY
            ? data.children.filter(child => activeItemsMap[child.path])
            : data.children;

        return activeCodeCrumbs
          ? children.map(i => i).sort(sortCcFiles(activeCodeCrumbs))
          : children;
      }

      if (!includeFileChildren) {
        return [];
      }

      return !activeCodeCrumbs
        ? data.children
        : (data.children || []).filter(({ params }) => activeCodeCrumbs[params.original]);
    },
    nodeSize: node => {
      let nameLength = node.data.name.length;

      if (node.parent && node.data.type === DIR_NODE_TYPE) {
        const children = node.parent.children;
        nameLength = children.reduce((max, item) => {
          if (item.data.type === DIR_NODE_TYPE && item.data.name.length > max) {
            return item.data.name.length;
          }

          return max;
        }, 0);
      }

      return [config.nodeSizeX, nameLength * config.symbolWidth + config.nodeSizeY];
    },
    spacing: (node, nodeB) => {
      // TODO: refactor
      if (
        extraSpaceForDetails &&
        node.data.type !== DIR_NODE_TYPE &&
        node.data.type !== FILE_NODE_TYPE
      ) {
        const { details } = node.data.params || {};
        if (details) {
          let nameWidth = node.data.name ? node.data.name.length * 7.5 : 100;
          if (nameWidth < 150) nameWidth = 150;

          const n = Math.ceil((details.length * 7) / nameWidth);
          return n > 3 ? config.detailsShift : n * 20 + 15;
        }
      }

      return config.spacing;
    }
  });

  const tree = layoutStructure.hierarchy(treeData);
  return layoutStructure(tree);
};

export const sortCcFiles = activeCodeCrumbs => (a, b) => {
  if (a.type !== FILE_NODE_TYPE || b.type !== FILE_NODE_TYPE || (!a.children && !b.children)) {
    return 0;
  }

  const bCc = (b.children || []).find(({ params = {} }) => activeCodeCrumbs[params.original]);
  const aCc = (a.children || []).find(({ params = {} }) => activeCodeCrumbs[params.original]);
  if (!bCc || !aCc) {
    return (bCc && !aCc) || (aCc && !bCc) ? -1 : 0;
  }

  return bCc.params.flowStep > aCc.params.flowStep ? 1 : -1;
};

export const getFileNodesMap = layoutNodes => {
  const map = {};

  layoutNodes.each(node => {
    if (node.data && node.data.type === FILE_NODE_TYPE) {
      map[node.data.path] = node;
    }
  });

  return map;
};

export const getCodecrumbNodesMap = fileNodesMap =>
  Object.keys(fileNodesMap).reduce((map, key) => {
    const node = fileNodesMap[key];
    if (node.data && node.data.type === FILE_NODE_TYPE && node.children) {
      map[node.data.path] = node;
    }

    return map;
  }, {});

export const getFilesForCurrentCcFlow = ({
  codeCrumbedFlowsMap,
  selectedCrumbedFlowKey,
  filesMap
}) => {
  return Object.keys(codeCrumbedFlowsMap[selectedCrumbedFlowKey]).filter(filePath => {
    const steps = ((filesMap[filePath] && filesMap[filePath].children) || []).filter(
      ({ params }) => params.flow === selectedCrumbedFlowKey
    );
    return steps && steps.length;
  });
};

export const getCodeCrumbsMapForCurrentCcFlow = ({
  codeCrumbedFlowsMap,
  selectedCrumbedFlowKey,
  filesMap
}) => {
  const ccMap = {};

  Object.keys(codeCrumbedFlowsMap[selectedCrumbedFlowKey])
    .map(filePath =>
      ((filesMap[filePath] && filesMap[filePath].children) || []).filter(
        ({ params }) => params.flow === selectedCrumbedFlowKey
      )
    )
    .filter(steps => steps.length)
    .forEach(steps => {
      steps.forEach(({ params }) => {
        ccMap[params.original] = 1;
      });
    });

  return ccMap;
};
