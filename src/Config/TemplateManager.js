import {textureManager} from './TextureManager';

class TemplateManager {
    constructor() {
        // Templates disponibles avec leurs informations
        this.templates = {
            'Retopo_TRONC001': {
                id: 'TreeNaked',
                path: '/models/forest/tree/TreeNaked.gltf',
                priority: 1,
                useTextures: true,
                group: 'regular'
            },
            'Retopo_GROS_TRONC001': {
                id: 'TrunkLarge',
                path: '/models/forest/tree/TrunkLarge.gltf',
                priority: 2,
                useTextures: true,
                group: 'regular'
            },
            'Retopo_TRONC_FIN': {
                id: 'TrunkThin',
                path: '/models/forest/tree/ThinTrunk.gltf',
                priority: 3,
                useTextures: true,
                group: 'regular'
            },
            'Trunk': {
                id: 'TreeStump',
                path: '/models/forest/tree/TreeStump.gltf',
                priority: 4,
                useTextures: true,
                group: 'regular'
            },
            'BranchEucalyptus': {
                id: 'BranchEucalyptus',
                path: '/models/forest/branch/BranchEucalyptus.glb',
                priority: 5,
                useTextures: true,
                group: 'regular'
            },
            'BUSHv2': {
                id: 'Bush',
                path: '/models/forest/bush/Bush.glb',
                priority: 6,
                useTextures: true,
                group: 'regular'
            },
            'BranchFig': {
                id: 'BranchFig',
                path: '/models/forest/branch/BranchFig.glb',
                priority: 7,
                useTextures: true,
                group: 'regular'
            },
            'BushBlueberry': {
                id: 'BushBlueberry',
                path: '/models/forest/bush/BushBlueberry.glb',
                priority: 8,
                useTextures: true,
                group: 'regular'
            },
            'BushRaspberry': {
                id: 'BushRaspberry',
                path: '/models/forest/bush/BushRaspberry.glb',
                priority: 9,
                useTextures: true,
                group: 'regular'
            },
            'BushTrunk': {
                id: 'BushTrunk',
                path: '/models/forest/bush/BushTrunk.glb',
                priority: 10,
                useTextures: true,
                group: 'regular'
            },
            'Strawberry006': {
                id: 'BushStrawberry',
                path: '/models/forest/bush/BushStrawberry.glb',
                priority: 11,
                useTextures: true,
                group: 'regular'
            },
            'FlowerBell005': {
                id: 'FlowerBell',
                path: '/models/forest/flower/FlowerBell.glb',
                priority: 12,
                useTextures: true,
                group: 'regular'
            },
            'Clover': {
                id: 'FlowerClover',
                path: '/models/forest/flower/FlowerClover.glb',
                priority: 13,
                useTextures: true,
                group: 'regular'
            },
            'MushwoomDuo': {
                id: 'MushroomDuo',
                path: '/models/forest/mushroom/MushroomDuo.glb',
                priority: 14,
                useTextures: true,
                group: 'regular'
            },
            'MushwoomSolo': {
                id: 'MushroomSolo',
                path: '/models/forest/mushroom/MushroomSolo.glb',
                priority: 15,
                useTextures: true,
                group: 'regular'
            },
            'PlanClematis005': {
                id: 'PlantClematis',
                path: '/models/forest/plant/PlanClematis.glb',
                priority: 16,
                useTextures: true,
                group: 'regular'
            },
            // 'PlantIvy002': {
            //     id: 'PlantIvy',
            //     path: '/models/forest/plant/PlantIvy.glb',
            //     priority: 17,
            //     useTextures: true,
            //     group: 'regular'
            // },
            'PlantMiscanthus': {
                id: 'PlantMiscanthus',
                path: '/models/forest/plant/PlantMiscanthus.glb',
                priority: 18,
                useTextures: true,
                group: 'regular'
            },
            'PlantPuccinellia': {
                id: 'PlantPuccinellia',
                path: '/models/forest/plant/PlantPuccinellia.glb',
                priority: 19,
                useTextures: true,
                group: 'regular'
            },
            'PlantReed': {
                id: 'PlantReed',
                path: '/models/forest/plant/PlantReed.glb',
                priority: 20,
                useTextures: true,
                group: 'regular'
            },
            'BranchTree002': {
                id: 'BranchTree',
                path: '/models/forest/branch/BranchTree.glb',
                priority: 20,
                useTextures: true,
                group: 'regular'
            },
            'TreeRoof': {
                id: 'TreeRoof',
                path: '/models/forest/tree/TreeRoof.glb',
                priority: 21,
                useTextures: true,
                group: 'regular'
            },
            'Grass_1': {
                id: 'Grass',
                path: '/models/forest/plant/Grass.glb',
                priority: 22,
                useTextures: true,
                group: 'regular'
            },

            // Groupe "End" - objets avec "End" dans leur ID
            'Retopo_TRONC001_1': {
                id: 'TreeNakedEnd',
                path: '/models/forest/tree/TreeNaked.gltf',
                priority: 1,
                useTextures: true,
                group: 'end'
            },
            'Retopo_GROS_TRONC001_2': {
                id: 'TrunkLargeEnd',
                path: '/models/forest/tree/TrunkLarge.gltf',
                priority: 2,
                useTextures: true,
                group: 'end'
            },
            'Retopo_TRONC_FIN_1': {
                id: 'TrunkThinEnd',
                path: '/models/forest/tree/ThinTrunk.gltf',
                priority: 3,
                useTextures: true,
                group: 'end'
            },
            'BranchEucalyptus_1': {
                id: 'BranchEucalyptusEnd',
                path: '/models/forest/branch/BranchEucalyptus.glb',
                priority: 5,
                useTextures: true,
                group: 'end'
            },
            'BUSH003': {
                id: 'BushEnd',
                path: '/models/forest/bush/Bush.glb',
                priority: 6,
                useTextures: true,
                group: 'end'
            },
            'BranchFig_1': {
                id: 'BranchFigEnd',
                path: '/models/forest/branch/BranchFig.glb',
                priority: 7,
                useTextures: true,
                group: 'end'
            },
            'BushBlueberry_1': {
                id: 'BushBlueberryEnd',
                path: '/models/forest/bush/BushBlueberry.glb',
                priority: 8,
                useTextures: true,
                group: 'end'
            },
            'BushRaspberry_1': {
                id: 'BushRaspberryEnd',
                path: '/models/forest/bush/BushRaspberry.glb',
                priority: 9,
                useTextures: true,
                group: 'end'
            },
            'BushTrunk002_1': {
                id: 'BushTrunkEnd',
                path: '/models/forest/bush/BushTrunk.glb',
                priority: 10,
                useTextures: true,
                group: 'end'
            },
            'Strawberry002_1': {
                id: 'BushStrawberryEnd',
                path: '/models/forest/bush/BushStrawberry.glb',
                priority: 11,
                useTextures: true,
                group: 'end'
            },
            'FlowerBell001_1': {
                id: 'FlowerBellEnd',
                path: '/models/forest/flower/FlowerBell.glb',
                priority: 12,
                useTextures: true,
                group: 'end'
            },
            'Clover_1': {
                id: 'FlowerCloverEnd',
                path: '/models/forest/flower/FlowerClover.glb',
                priority: 13,
                useTextures: true,
                group: 'end'
            },
            'MushwoomDuo_1': {
                id: 'MushroomDuoEnd',
                path: '/models/forest/mushroom/MushroomDuo.glb',
                priority: 14,
                useTextures: true,
                group: 'end'
            },
            'MushwoomSolo_1': {
                id: 'MushroomSoloEnd',
                path: '/models/forest/mushroom/MushroomSolo.glb',
                priority: 15,
                useTextures: true,
                group: 'end'
            },
            'PlantClematis_1': {
                id: 'PlantClematisEnd',
                path: '/models/forest/plant/PlanClematis.glb',
                priority: 16,
                useTextures: true,
                group: 'end'
            },
            'PlantIvy002_1': {
                id: 'PlantIvyEnd',
                path: '/models/forest/plant/PlantIvy.glb',
                priority: 17,
                useTextures: true,
                group: 'end'
            },
            'PlantMiscanthus_1': {
                id: 'PlantMiscanthusEnd',
                path: '/models/forest/plant/PlantMiscanthus.glb',
                priority: 18,
                useTextures: true,
                group: 'end'
            },
            'PlantPuccinellia_1': {
                id: 'PlantPuccinelliaEnd',
                path: '/models/forest/plant/PlantPuccinellia.glb',
                priority: 19,
                useTextures: true,
                group: 'end'
            },
            'PlantReed_1': {
                id: 'PlantReedEnd',
                path: '/models/forest/plant/PlantReed.glb',
                priority: 20,
                useTextures: true,
                group: 'end'
            },
            'BranchTree002_1': {
                id: 'BranchTreeEnd',
                path: '/models/forest/branch/BranchTree.glb',
                priority: 20,
                useTextures: true,
                group: 'end'
            },

            // Groupe "Screen" - écrans
            'OLD_2': {
                id: 'ScreenOld',
                path: '/models/digital/screen/ScreenOld.glb',
                priority: 21,
                useTextures: true,
                group: 'screen'
            },
            'Screen_4': {
                id: 'Screen',
                path: '/models/digital/screen/Screen.glb',
                priority: 22,
                useTextures: true,
                group: 'screen'
            },

            // Exemple d'ajout d'un nouveau template :
            // 'NouveauTemplate': {
            //     id: 'NouvelArbre',
            //     path: '/models/forest/tree/NouvelArbre.gltf',
            //     priority: 5,
            //     useTextures: true,
            //     group: 'regular'
            // },
        };

        // Un mapping inversé pour une recherche rapide par ID
        this.idToTemplateMap = {
            753: 'Retopo_TRONC001',
            1021: 'Retopo_TRONC_FIN',
            1015: 'Retopo_GROS_TRONC001',
            925: 'Trunk',
            46: 'Plane003',
            8414: 'Plane_7',
            // Ajoutez de nouveaux mappings ID ici
        };

        // Catégorie pour les objets non reconnus
        this.undefinedCategory = 'Undefined';

        // Groupes disponibles
        this.groups = {
            'regular': 'Objets standards',
            'end': 'Objets "End"',
            'screen': 'Écrans'
        };
    }

    // Obtenir tous les types d'objets disponibles (y compris Undefined)
    getAllObjectTypes() {
        const types = Object.values(this.templates).map(template => template.id);
        return [...new Set([...types, this.undefinedCategory])];
    }

    // Obtenir tous les groupes disponibles
    getAllGroups() {
        return Object.keys(this.groups);
    }

    // Obtenir tous les objets d'un groupe spécifique
    getObjectsByGroup(groupName) {
        return Object.entries(this.templates)
            .filter(([_, template]) => template.group === groupName)
            .map(([_, template]) => template.id);
    }

    // Créer une structure vide pour stocker les positions des objets
    createEmptyPositionsStructure() {
        const structure = {};
        this.getAllObjectTypes().forEach(type => {
            structure[type] = [];
        });
        return structure;
    }

    // Obtenir le type d'objet correspondant à un template
    getObjectTypeFromTemplate(templateName) {
        return this.templates[templateName]?.id || this.undefinedCategory;
    }

    // Obtenir le groupe d'un objet à partir de son identifiant
    getGroupFromObjectId(objectId) {
        // Rechercher le groupe approprié en fonction de l'ID
        const entry = Object.values(this.templates).find(template => template.id === objectId);
        return entry?.group || 'regular'; // 'regular' par défaut si non trouvé
    }

    // Obtenir le template correspondant à un ID d'instance
    getTemplateFromId(id) {
        return this.idToTemplateMap[id] || null;
    }

    // Vérifier si un modèle utilise des textures
    doesModelUseTextures(templateName) {
        return this.templates[templateName]?.useTextures === true;
    }

    // Obtenir l'ID de modèle pour appliquer les textures
    getTextureModelId(templateName) {
        return this.templates[templateName]?.id || null;
    }

    // Ajouter un nouveau template
    addTemplate(templateName, objectId, assetPath, priority = 999, useTextures = true, group = 'regular') {
        this.templates[templateName] = {
            id: objectId,
            path: assetPath,
            priority,
            useTextures,
            group
        };
        return this;
    }

    // Ajouter un mapping d'ID pour un template
    addIdMapping(id, templateName) {
        if (this.templates[templateName]) {
            this.idToTemplateMap[id] = templateName;
        } else {
            console.warn(`Template ${templateName} n'existe pas. Ajoutez-le d'abord.`);
        }
        return this;
    }

    // Obtenir la liste des assets requis avec leurs chemins
    getRequiredAssets() {
        const assets = [];
        Object.values(this.templates).forEach(template => {
            assets.push({
                name: template.id,   // Nom de l'asset = id de l'objet
                path: template.path  // Chemin de l'asset
            });
        });
        return assets;
    }

    // Générer la liste des assets au format attendu par l'AssetManager
    generateAssetList() {
        // Commencer par les modèles 3D
        const assetList = Object.values(this.templates).map(template => ({
            name: template.id,
            type: 'gltf',
            path: template.path,
            license: 'CC-BY',
            author: 'Author',
            url: ''
        }));

        // Ajouter les textures requises si TextureManager est disponible
        if (textureManager) {
            const textureAssets = textureManager.generateTextureAssetList();
            assetList.push(...textureAssets);
        }

        return assetList;
    }

    // Appliquer les textures à un modèle spécifique
    async applyTexturesToModelIfNeeded(templateName, modelObject) {
        if (!modelObject || !this.doesModelUseTextures(templateName)) return;

        const modelId = this.getTextureModelId(templateName);
        if (modelId && textureManager) {
            await textureManager.applyTexturesToModel(modelId, modelObject);
        }
    }
}

// Export d'une instance singleton
export const templateManager = new TemplateManager();
export default templateManager;