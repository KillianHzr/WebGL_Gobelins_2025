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
    },

    // Éléments de base de la scène
    {
        name: 'Ground',
        type: 'gltf',
        path: '/models/Ground.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },

    // Objets primaires (interactifs et statiques)
    {
        name: 'DirectionPanel',
        type: 'gltf',
        path: '/models/primary/DirectionPanel.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'Vison',
        type: 'gltf',
        path: '/models/primary/Vison.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'MultipleLeaf',
        type: 'gltf',
        path: '/models/primary/MultipleLeaf.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'AnimalPaws',
        type: 'gltf',
        path: '/models/primary/AnimalPaws.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },

    // Objets interactifs statiques de la scène
    {
        name: 'DirectionPanelStartInteractive',
        type: 'gltf',
        path: '/models/primary/DirectionPanel.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'DirectionPanelEndInteractive',
        type: 'gltf',
        path: '/models/primary/DirectionPanel.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'TrunkLargeInteractive',
        type: 'gltf',
        path: '/models/forest/tree/ObstacleTree.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'LeafErable',
        type: 'gltf',
        path: '/models/primary/MultipleLeaf.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'ThinTrunkInteractive',
        type: 'gltf',
        path: '/models/forest/tree/Obstacle2Tree.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    // Arbres et troncs
    {
        name: 'TreeNaked',
        type: 'gltf',
        path: '/models/forest/tree/TreeNaked.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'TrunkLarge',
        type: 'gltf',
        path: '/models/forest/tree/TrunkLarge.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'TrunkThin',
        type: 'gltf',
        path: '/models/forest/tree/ThinTrunk.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'TreeStump',
        type: 'gltf',
        path: '/models/forest/tree/TreeStump.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'ObstacleTree',
        type: 'gltf',
        path: '/models/forest/tree/ObstacleTree.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'Obstacle2Tree',
        type: 'gltf',
        path: '/models/forest/tree/Obstacle2Tree.gltf',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'BigRock',
        type: 'gltf',
        path: '/models/rock/BigRock.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },

    // Buissons et plantes
    {
        name: 'Bush',
        type: 'gltf',
        path: '/models/forest/bush/Bush.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'BushBlueberry',
        type: 'gltf',
        path: '/models/forest/bush/BushBlueberry.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'BushRaspberry',
        type: 'gltf',
        path: '/models/forest/bush/BushRaspberry.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'BushTrunk',
        type: 'gltf',
        path: '/models/forest/bush/BushTrunk.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'BushStrawberry',
        type: 'gltf',
        path: '/models/forest/bush/BushStrawberry.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'BranchEucalyptus',
        type: 'gltf',
        path: '/models/forest/branch/BranchEucalyptus.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'BranchFig',
        type: 'gltf',
        path: '/models/forest/branch/BranchFig.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },

    // Rochers
    {
        name: 'RockWater',
        type: 'gltf',
        path: '/models/rock/RockWater.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'RockWater2',
        type: 'gltf',
        path: '/models/rock/RockWater2.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'WaterPlane',
        type: 'gltf',
        path: '/models/forest/river/River.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    }
];

// Export de la liste d'assets de base
export default baseAssets;