const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const workspaceRoot = path.resolve(__dirname, '../..');

const config = {
  projectRoot: __dirname,

  watchFolders: [workspaceRoot],

  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    // Monorepo: npm eleva paquetes sin conflicto a la raíz (p. ej.
    // @react-navigation/*) mientras React 19 queda anidado en
    // apps/mobile/node_modules. Sin esto, Metro mezcla React 18 (raíz)
    // con React 19 (mobile) y los hooks fallan (dispatcher null).
    // Con hierarchical lookup desactivado, todo se resuelve vía
    // nodeModulesPaths en orden: mobile primero, raíz después.
    disableHierarchicalLookup: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);