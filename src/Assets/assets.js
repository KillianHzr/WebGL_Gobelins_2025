// assets.js
// Fichier de configuration des assets de base à charger dans l'AssetManager
// Les assets des templates seront ajoutés directement par AssetManager

// Définition des assets de base à charger
const baseAssets = [
    // Map
    {
        name: 'Map',
        type: 'gltf',
        path: '/models/Map.glb', // Chemin absolu depuis le dossier "static"
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    // Map
    {
        name: 'MapInstance',
        type: 'gltf',
        path: '/models/MapInstance.glb', // Chemin absolu depuis le dossier "static"
        license: 'CC-BY',
        author: 'Author',
        url: ''
    }
    // Les assets des templates (arbres, rochers, etc.) sont ajoutés automatiquement
    // par l'AssetManager en utilisant templateManager.generateAssetList()
];

// Export de la liste d'assets de base
export default baseAssets;