// assets.js
// Fichier de configuration des assets de base à charger dans l'AssetManager
// Les assets des templates seront ajoutés directement par AssetManager

// Définition des assets de base à charger
const baseAssets = [
    // Map
    {
        name: 'Map',
        type: 'gltf',
        path: '/models/Map.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'MapInstance',
        type: 'gltf',
        path: '/models/MapInstance.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    }
    ];

// Export de la liste d'assets de base
export default baseAssets;