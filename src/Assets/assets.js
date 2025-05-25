const baseAssets = [
    // Map
    {
        name: 'Map',
        type: 'gltf',
        path: '/models/Map.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },{
        name: 'Camera',
        type: 'gltf',
        path: '/models/Camera.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'MapInstance',
        type: 'gltf',
        path: '/models/MapDefault.glb',
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
        path: '/models/primary/DirectionPanel.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    }, {
        name: 'DirectionPanelDigital',
        type: 'gltf',
        path: '/models/primary/DigitalDirectionPanel.glb',
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
        path: '/models/primary/MultipleLeaf.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'AnimalPaws',
        type: 'gltf',
        path: '/models/primary/AnimalPaws.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },

    // Objets interactifs statiques de la scène
    {
        name: 'DirectionPanelStartInteractive',
        type: 'gltf',
        path: '/models/primary/DigitalDirectionPanel.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'DirectionPanelEndInteractive',
        type: 'gltf',
        path: '/models/primary/DigitalDirectionPanel.glb',
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
    },{
        name: 'TrunkThinPlane',
        type: 'gltf',
        path: '/models/forest/tree/TreeThinPlane.glb',
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
    {
        name: 'BranchTree',
        type: 'gltf',
        path: '/models/forest/branch/BranchTree.glb',
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
    },

    // Modèles ajoutés depuis TemplateManager.js
    {
        name: 'FlowerBell',
        type: 'gltf',
        path: '/models/forest/flower/FlowerBell.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'FlowerClover',
        type: 'gltf',
        path: '/models/forest/flower/FlowerClover.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'MushroomDuo',
        type: 'gltf',
        path: '/models/forest/mushroom/MushroomDuo.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'MushroomSolo',
        type: 'gltf',
        path: '/models/forest/mushroom/MushroomSolo.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'PlanClematis',
        type: 'gltf',
        path: '/models/forest/plant/PlanClematis.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'DataCenter',
        type: 'gltf',
        path: '/models/digital/DataCenter.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    // {
    //     name: 'PlantIvy',
    //     type: 'gltf',
    //     path: '/models/forest/plant/PlantIvy.glb',
    //     license: 'CC-BY',
    //     author: 'Author',
    //     url: ''
    // },
    {
        name: 'PlantMiscanthus',
        type: 'gltf',
        path: '/models/forest/plant/PlantMiscanthus.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'PlantPuccinellia',
        type: 'gltf',
        path: '/models/forest/plant/PlantPuccinellia.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'PlantReed',
        type: 'gltf',
        path: '/models/forest/plant/PlantReed.glb',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    },
    {
        name: 'EnvironmentMap',
        type: 'hdr', // ou 'exr'
        path: '/textures/environmentMap/environment_map.hdr',
        license: 'CC-BY',
        author: 'Author',
        url: ''
    }
];

// Export de la liste d'assets de base
export default baseAssets;