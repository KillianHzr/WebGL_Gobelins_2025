// TemplateManager.js
// Système centralisé pour la gestion des templates et des instances

import { textureManager } from './TextureManager';

class TemplateManager {
    constructor() {
        // Templates disponibles avec leurs informations
        this.templates = {
            'Retopo_TRONC001': {
                // Utilisation du même identifiant pour le type et l'asset
                id: 'TreeNaked',
                path: '/models/forest/tree/TreeNaked.gltf',
                priority: 1,
                useTextures: true  // Indique si ce modèle doit utiliser des textures
            },
            'Retopo_GROS_TRONC001': {
                id: 'TrunkLarge',
                path: '/models/forest/tree/TrunkLarge.gltf',
                priority: 2,
                useTextures: true
            },
            'Retopo_TRONC_FIN': {
                id: 'ThinTrunk',
                path: '/models/forest/tree/ThinTrunk.gltf',
                priority: 3,
                useTextures: true
            },
            'Trunk': {
                id: 'TreeStump',
                path: '/models/forest/tree/TreeStump.gltf',
                priority: 4,
                useTextures: true
            },

            'Plane_7': {
                id: 'BranchEucalyptus',
                path: '/models/forest/plant/BranchEucalyptus.glb',
                priority: 5,
                useTextures: true
            },
            'Plane003': {
                id: 'Bush',
                path: '/models/forest/bush/Bush.glb',
                priority: 6,
                useTextures: true
            },
            // Exemple d'ajout d'un nouveau template :
            // 'NouveauTemplate': {
            //     id: 'NouvelArbre',
            //     path: '/models/forest/tree/NouvelArbre.gltf',
            //     priority: 5,
            //     useTextures: true
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
    }

    // Obtenir tous les types d'objets disponibles (y compris Undefined)
    getAllObjectTypes() {
        const types = Object.values(this.templates).map(template => template.id);
        return [...new Set([...types, this.undefinedCategory])];
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
    addTemplate(templateName, objectId, assetPath, priority = 999, useTextures = true) {
        this.templates[templateName] = {
            id: objectId,
            path: assetPath,
            priority,
            useTextures
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