// TemplateManager.js
// Système centralisé pour la gestion des templates et des instances

class TemplateManager {
    constructor() {
        // Templates disponibles avec leurs informations
        this.templates = {
            'Retopo_TRONC001': {
                // Utilisation du même identifiant pour le type et l'asset
                id: 'TreeNaked',
                path: '/models/forest/tree/TreeNaked.glb',
                priority: 1
            },
            'Retopo_GROS_TRONC001': {
                id: 'TrunkLarge',
                path: '/models/forest/tree/TrunkLarge.glb',
                priority: 2
            },
            'Retopo_TRONC_FIN': {
                id: 'ThinTrunk',
                path: '/models/forest/tree/ThinTrunk.glb',
                priority: 3
            },
            'Trunk': {
                id: 'TreeStump',
                path: '/models/forest/tree/TreeStump.glb',
                priority: 4
            },
            'Plane003': {
                id: 'Bush',
                path: '/models/forest/bush/Bush.glb',
                priority: 5
            },
            'Plane_7': {
                id: 'BranchEucalyptus',
                path: '/models/forest/plant/BranchEucalyptus.glb',
                priority: 6,
                useTextures: true
            },
            // Exemple d'ajout d'un nouveau template :
            // 'NouveauTemplate': {
            //     id: 'NouvelArbre',
            //     path: '/models/forest/tree/NouvelArbre.glb',
            //     priority: 5
            // },
        };

        // Un mapping inversé pour une recherche rapide par ID
        this.idToTemplateMap = {
            753: 'Retopo_TRONC001',
            1021: 'Retopo_TRONC_FIN',
            1015: 'Retopo_GROS_TRONC001',
            925: 'Trunk',
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

    // Ajouter un nouveau template
    addTemplate(templateName, objectId, assetPath, priority = 999) {
        this.templates[templateName] = {
            id: objectId,
            path: assetPath,
            priority
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
        return Object.values(this.templates).map(template => ({
            name: template.id,
            type: 'gltf',
            path: template.path,
            license: 'CC-BY',
            author: 'Author',
            url: ''
        }));
    }
}

// Export d'une instance singleton
export const templateManager = new TemplateManager();
export default templateManager;