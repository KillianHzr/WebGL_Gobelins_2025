import {
    BufferAttribute, BufferGeometry,
    DoubleSide,
    Group,
    LinearFilter,
    Matrix4,
    Mesh, MeshBasicMaterial,
    MeshStandardMaterial,
    RepeatWrapping,
    SRGBColorSpace, StaticDrawUsage,
    TextureLoader, Vector3
} from "three";
import {LinearEncoding} from "@react-three/drei/helpers/deprecated.js";

/**
 * TextureManager - Version optimisée avec fusion de matériaux et configuration précise des propriétés
 *
 * Optimisations:
 * - Système de fusion de matériaux pour les modèles déjà chargés
 * - Gestion de LOD (Level of Detail) pour les textures
 * - Mécanisme de réduction de mémoire pour les instances multiples
 * - Système d'analyse et d'optimisation automatique
 * - Configuration précise des propriétés des matériaux (roughness, metalness, envMapIntensity)
 */
class TextureManager {
    constructor() {
        // Structure des chemins de textures disponibles
        this.texturePaths = {};

        // Propriétés personnalisées pour chaque modèle
        this.materialProperties = {};

        // Cache global des textures chargées
        this.loadedTextures = {};

        // Pool de matériaux pour la réutilisation
        this.materialPool = {};

        // Gestion des instances et statistiques
        this.instanceTracker = {};

        // Gestion de LOD pour les textures
        this.textureResolutions = {
            high: 1.0,    // Résolution complète
            medium: 0.5,  // Résolution moitié
            low: 0.25     // Résolution quart
        };

        // Niveau de LOD par défaut (peut être ajusté dynamiquement)
        this.currentLOD = 'high';

        // Paramètres d'optimisation
        this.optimizationConfig = {
            mergeThreshold: 1,           // Nombre d'instances avant de considérer une fusion
            maxTextureSize: 1024,        // Taille maximum de texture en pixels
            distanceThresholds: {        // Seuils de distance pour LOD
                high: 15,
                medium: 25,
                low: Infinity
            },
            instanceMergeDistance: 100,  // Distance max pour une fusion d'instance
            autoMergeEnabled: true,      // Activer la fusion automatique
            memoryBudget: 500,           // Budget mémoire en MB pour les textures
            materialMergeEnabled: true,  // Activer la fusion de matériaux similaires
            materialSimilarityThreshold: 0.85 // Seuil de similarité pour fusionner des matériaux (0.0-1.0)
        };

        // Statistiques d'utilisation (pour debugging et monitoring)
        this.stats = {
            texturesLoaded: 0,
            materialsCreated: 0,
            materialsMerged: 0,
            instancesMerged: 0,
            memoryUsage: 0,
            lastOptimization: null
        };

        // Valeurs par défaut pour les propriétés de matériaux
        this.defaultMaterialProperties = {
            roughness: 0.8,
            metalness: 0.1,
            envMapIntensity: 0.5,
            aoIntensity: 0.5,
            normalScale: 1.0,
            displacementScale: 0.0,
            side: DoubleSide,
            depthWrite: true,
            depthTest: true,

        };
        this.initializeTextures();

    }

    initializeGroundTextures() {
        console.log("Initialisation des textures complètes pour le terrain");

        // Définir les textures pour l'herbe avec toutes les maps
        this.addTextureMapping('ForestGrass', 'ground', 'ForestGrass', {
            roughness: 1.0,
            metalness: 0.05,
            envMapIntensity: 0.2,
            normalScale: 1.0
        });

        // Définir les textures pour le chemin avec toutes les maps
        this.addTextureMapping('ForestRoad', 'ground', 'ForestRoad', {
            roughness: 0.9,
            metalness: 0.1,
            envMapIntensity: 0.3,
            normalScale: 1.2
        });

        // Configuration spéciale pour Ground qui utilise ForestGrass et ForestRoad
        this.texturePaths['Ground'] = {
            grass: this.texturePaths['ForestGrass'],
            road: this.texturePaths['ForestRoad']
        };

        // Ajouter une propriété pour indiquer que c'est un terrain avec chemin
        this.materialProperties['Ground'] = {
            ...this.defaultMaterialProperties,
            isGround: true,
            vertexColors: true,
            roughness: 0.95,
            metalness: 1.0,
            envMapIntensity: 0.05
        };

        console.log("Textures de terrain initialisées avec toutes les maps disponibles");
    }


    ensureVertexColors(meshNode) {
        if (!meshNode.geometry) return;

        // Vérifier si le mesh a déjà des vertex colors
        if (!meshNode.geometry.attributes.color) {
            console.log("Création des vertex colors sur le mesh");

            // Créer un attribut color si nécessaire
            const positions = meshNode.geometry.attributes.position;
            const count = positions.count;
            const colors = new Float32Array(count * 3);

            // Initialiser toutes les couleurs à l'herbe (R=0 pour l'herbe)
            for (let i = 0; i < count; i++) {
                colors[i * 3] = 0.0;     // R - Route (0 = herbe)
                colors[i * 3 + 1] = 0.5;  // G - Pour la visibilité
                colors[i * 3 + 2] = 0.0;  // B - Non utilisé
            }

            meshNode.geometry.setAttribute('color', new BufferAttribute(colors, 3));
        }
    }

    /**
     * Créer un matériau spécifique pour le terrain
     */
    // Correction de la méthode createGroundMaterial() dans TextureManager.js

    createGroundMaterial() {
        // Vérifier si le matériau existe déjà dans le pool
        if (this.materialPool['ground_special']) {
            return this.materialPool['ground_special'];
        }

        console.log("Création d'un matériau avancé pour le terrain avec toutes les maps");

        // Créer un matériau de base pour le terrain
        const material = new MeshStandardMaterial({
            name: 'ground_material',
            vertexColors: true,
            side: DoubleSide,
            transparent: false,
            roughness: 0.95,
            metalness: 0.08,
            envMapIntensity: 0.25
        });

        // Précharger les textures
        Promise.all([
            this.preloadTexturesForModel('ForestGrass'),
            this.preloadTexturesForModel('ForestRoad')
        ]).then(([grassTextures, roadTextures]) => {
            if (!grassTextures || !roadTextures) {
                console.error("Impossible de charger les textures pour le terrain");
                return;
            }

            console.log("Textures chargées pour le matériau de terrain:", {
                grass: Object.keys(grassTextures),
                road: Object.keys(roadTextures)
            });

            // Configurer le shader personnalisé pour mélanger les textures
            material.userData.isGroundMaterial = true;
            material.onBeforeCompile = (shader) => {
                // Ajouter les uniforms pour toutes les textures
                shader.uniforms.grassMap = { value: grassTextures.baseColor };
                shader.uniforms.roadMap = { value: roadTextures.baseColor };

                // Ajouter les maps normales si disponibles
                if (grassTextures.normalOpenGL && roadTextures.normalOpenGL) {
                    shader.uniforms.grassNormalMap = { value: grassTextures.normalOpenGL };
                    shader.uniforms.roadNormalMap = { value: roadTextures.normalOpenGL };
                }

                // Ajouter les maps de rugosité si disponibles
                if (grassTextures.roughness && roadTextures.roughness) {
                    shader.uniforms.grassRoughnessMap = { value: grassTextures.roughness };
                    shader.uniforms.roadRoughnessMap = { value: roadTextures.roughness };
                }

                // Ajouter les maps métalliques si disponibles
                if (grassTextures.metalness && roadTextures.metalness) {
                    shader.uniforms.grassMetallicMap = { value: grassTextures.metalness };
                    shader.uniforms.roadMetallicMap = { value: roadTextures.metalness };
                }

                // Ajouter les maps de hauteur si disponibles
                if (grassTextures.height && roadTextures.height) {
                    shader.uniforms.grassHeightMap = { value: grassTextures.height };
                    shader.uniforms.roadHeightMap = { value: roadTextures.height };
                }

                // Modifier le vertex shader pour transmettre les UVs et les couleurs de vertex
                const vertexPars = `
                varying vec2 vUv;
                varying vec3 vVertexColor;
            `;
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <common>',
                    '#include <common>\n' + vertexPars
                );

                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    '#include <begin_vertex>\n\tvUv = uv;\n\tvVertexColor = color.rgb;'
                );

                // Modifier le fragment shader pour mélanger les textures
                const fragmentPars = `
                varying vec2 vUv;
                varying vec3 vVertexColor;
                uniform sampler2D grassMap;
                uniform sampler2D roadMap;
                
                // Maps supplémentaires
                uniform sampler2D grassNormalMap;
                uniform sampler2D roadNormalMap;
                uniform sampler2D grassRoughnessMap;
                uniform sampler2D roadRoughnessMap;
                uniform sampler2D grassMetallicMap;
                uniform sampler2D roadMetallicMap;
                uniform sampler2D grassHeightMap;
                uniform sampler2D roadHeightMap;
            `;

                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <common>',
                    '#include <common>\n' + fragmentPars
                );

                // Remplacer la méthode d'échantillonnage
                shader.fragmentShader = shader.fragmentShader.replace(
                    'vec4 diffuseColor = vec4( diffuse, opacity );',
                    `
                // Échantillonner les textures couleur
                vec4 grassColor = texture2D(grassMap, vUv);
                vec4 roadColor = texture2D(roadMap, vUv);
                
                // Utiliser le canal R pour mélanger
                float roadFactor = vVertexColor.r;
                
                // Mélanger les textures de couleur
                vec4 diffuseColor = mix(grassColor, roadColor, roadFactor);
                diffuseColor.a = opacity;
                `
                );

                // Si nous avons des maps normales, les configurer
                if (grassTextures.normalOpenGL && roadTextures.normalOpenGL) {
                    const normalParsAdd = `
                    // Mélanger les normales
                    vec3 grassNormal = texture2D(grassNormalMap, vUv).rgb * 2.0 - 1.0;
                    vec3 roadNormal = texture2D(roadNormalMap, vUv).rgb * 2.0 - 1.0;
                    vec3 mixedNormal = mix(grassNormal, roadNormal, roadFactor);
                    
                    // Remplacer la normale
                    normal = normalize(mixedNormal);
                `;

                    // Trouver un bon endroit pour insérer notre code de mélange de normales
                    // (ceci est simplifié, dans un vrai shader il faudrait être plus précis)
                    const normalMapPos = shader.fragmentShader.indexOf('#include <normal_fragment_maps>');
                    if (normalMapPos > -1) {
                        shader.fragmentShader = shader.fragmentShader.slice(0, normalMapPos) +
                            normalParsAdd +
                            shader.fragmentShader.slice(normalMapPos);
                    }
                }

                // Si nous avons des maps de rugosité et métalliques, les configurer
                if (grassTextures.roughness && roadTextures.roughness &&
                    grassTextures.metalness && roadTextures.metalness) {

                    // Trouver où remplacer la rugosité et la métallicité
                    const roughnessPos = shader.fragmentShader.indexOf('roughnessFactor');
                    if (roughnessPos > -1) {
                        // Ajouter notre code après la déclaration mais avant son utilisation
                        const roughnessAdd = `
                        // Mélanger la rugosité
                        float grassRoughness = texture2D(grassRoughnessMap, vUv).r;
                        float roadRoughness = texture2D(roadRoughnessMap, vUv).r;
                        roughnessFactor *= mix(grassRoughness, roadRoughness, roadFactor);
                        
                        // Mélanger la métallicité
                        float grassMetallic = texture2D(grassMetallicMap, vUv).r;
                        float roadMetallic = texture2D(roadMetallicMap, vUv).r;
                        metalnessFactor *= mix(grassMetallic, roadMetallic, roadFactor);
                    `;

                        // Chercher un bon point d'insertion
                        const insertPos = shader.fragmentShader.indexOf('material.roughness');
                        if (insertPos > -1) {
                            shader.fragmentShader = shader.fragmentShader.slice(0, insertPos) +
                                roughnessAdd +
                                shader.fragmentShader.slice(insertPos);
                        }
                    }
                }

                material.userData.shader = shader;
            };

            // Configurer les maps sur le matériau standard
            if (grassTextures.normalOpenGL) {
                material.normalMap = grassTextures.normalOpenGL;
                this.configureTexture(material.normalMap, 'normalOpenGL');
                material.normalScale = { x: 1.0, y: 1.0 };
            }

            if (grassTextures.roughness) {
                material.roughnessMap = grassTextures.roughness;
                this.configureTexture(material.roughnessMap, 'roughness');
            }

            if (grassTextures.metalness) {
                material.metalnessMap = grassTextures.metalness;
                this.configureTexture(material.metalnessMap, 'metalness');
            }

            material.needsUpdate = true;
        });

        // Stocker dans le pool
        this.materialPool['ground_special'] = material;

        return material;
    }

    // Initialisation des textures basée sur la structure de fichiers
    initializeTextures() {
        // Arbres
        this.addTextureMapping('TreeNaked', 'forest/tree', null, {
            roughness: 1.0,
            metalness: 0.59,
            envMapIntensity: 0.08
        });

        this.addTextureMapping('TrunkLarge', 'forest/tree', null, {
            roughness: 0.78,
            metalness: 0.71,
            envMapIntensity: 0.08
        });

        this.addTextureMapping('TrunkThin', 'forest/tree', 'TrunkThin', {
            roughness: 0.81,
            metalness: 0.7,
            envMapIntensity: 0.08
        });

        // this.addPlantTexture('TrunkThinPlane', 'forest/tree', {
        //     roughness: 0.81,
        //     metalness: 0.7,
        //     envMapIntensity: 0.08
        // });
        this.addTextureMapping('TreeNaked', 'forest/tree', null, {
            roughness: 1.0,
            metalness: 0.59,
            envMapIntensity: 0.08
        });

        this.addTextureMapping('TrunkLargeEnd', 'forest/tree', 'TrunkLarge', {
            roughness: 0.78,
            metalness: 0.71,
            envMapIntensity: 0.08
        });

        this.addTextureMapping('TrunkThinEnd', 'forest/tree', 'TrunkThin', {
            roughness: 0.81,
            metalness: 0.7,
            envMapIntensity: 0.08
        });
        this.addTextureMapping('TreeNakedEnd', 'forest/tree', 'TreeNaked', {
            roughness: 1.0,
            metalness: 0.59,
            envMapIntensity: 0.08
        });

        this.addTextureMapping('TrunkLargeDigital', 'forest/tree', 'TrunkLarge', {
            roughness: 0.78,
            metalness: 0.71,
            envMapIntensity: 0.08
        });

        this.addTextureMapping('TrunkThinDigital', 'forest/tree', 'TrunkThin', {
            roughness: 0.81,
            metalness: 0.7,
            envMapIntensity: 0.08
        });

        this.addTextureMapping('TreeStumpDigital', 'forest/tree', 'TreeNaked', {
            roughness: 0.81,
            metalness: 0.7,
            envMapIntensity: 0.08
        });

        this.addTextureMapping('TreeRoots', 'forest/tree', null, {
            roughness: 0.81,
            metalness: 0.7,
            // envMapIntensity: 0.08
        });
        this.addRandomizedTexture('TreeRoof', 'forest/tree', {
            roughness: 1.0,
            metalness: 0.0,
            // envMapIntensity: 0.05
        });

        // Branches et Buissons
        this.addPlantTexture('BranchTree', 'forest/branch', {
            roughness: 0.7,
            metalness: 0.0,
            // envMapIntensity: 0.46,
            castShadow: true,
            receivedShadow: true,
        });

        this.addPlantTexture('BranchEucalyptus', 'forest/branch', {
            roughness: 0.7,
            metalness: 0.0,
            // envMapIntensity: 0.46,
            castShadow: true,

            receivedShadow: true,
        });

        this.addPlantTexture('BranchFig', 'forest/branch', {
            roughness: 0.7,
            metalness: 0.0,
            // envMapIntensity: 0.46,
            castShadow: true,

            receivedShadow: true,
        });

        // Buissons
        this.addPlantTexture('Bush', 'forest/bush', {
            roughness: 1.0,
            // metalness: 1.0,
            // envMapIntensity: 0.46
        });

        this.addPlantTexture('BushBlueberry', 'forest/bush', {
            roughness: 1.0,
            // metalness: 1.0,
            // envMapIntensity: 0.46
        });

        this.addPlantTexture('BushRaspberry', 'forest/bush', {
            roughness: 1.0,
            // metalness: 1.0,
            // envMapIntensity: 0.46
        });

        this.addPlantTexture('BushStrawberry', 'forest/bush', {
            roughness: 1.0,
            // metalness: 1.0,
            // envMapIntensity: 0.46
        });

        this.addPlantTexture('BushTrunk', 'forest/bush', {

            roughness: 0.7,
            metalness: 0.0,
            // envMapIntensity: 0.10,
            // castShadow: true,

            // receivedShadow: false,
        });

        // Plantes
        this.addPlantTexture('PlantPuccinellia', 'forest/plant', {

            roughness: 0.7,
            metalness: 0.0,
            // envMapIntensity: 0.46,
            castShadow: true,

            receivedShadow: true,
        });

        this.addPlantTexture('PlantReed', 'forest/plant', {

            roughness: 0.7,
            metalness: 0.0,
            // envMapIntensity: 0.46,
            castShadow: true,

            receivedShadow: true,
        });
        this.addPlantTexture('animalPaws', 'primary', {

            roughness: 0.7,
            metalness: 0.0,
            // envMapIntensity: 0.46,
            castShadow: true,

            receivedShadow: true,
        });

        this.addPlantTexture('PlantMiscanthus', 'forest/plant', {
            roughness: 0.7,
            metalness: 0.0,
            // envMapIntensity: 0.46,
            castShadow: true,

            receivedShadow: true,
        });

        this.addPlantTexture('PlantClematis', 'forest/plant', {

            roughness: 0.7,
            metalness: 0.0,
            // envMapIntensity: 0.46,
            castShadow: true,

            receivedShadow: true,
        });
        this.addPlantTexture('Grass', 'forest/plant', {
            roughness: 0.7,
            metalness: 0.0,
            // envMapIntensity: 0.46,
            castShadow: true,

            receivedShadow: true,
        });

        // Fleurs
        this.addPlantTexture('FlowerBell', 'forest/flower', {
            roughness: 0.7,
            metalness: 0.0,
            // envMapIntensity: 0.46,
            castShadow: true,

            receivedShadow: true,
        });

        this.addPlantTexture('FlowerClover', 'forest/flower', {
            roughness: 0.8,
            // metalness: 1.0,
            // envMapIntensity: 0.46
        });

        this.addPlantTexture('FlowerChicory', 'forest/flower', {
            roughness: 0.75,
            // metalness: 1.0,
            // envMapIntensity: 0.46
        });

        // Champignons
        this.addPlantTexture('MushroomSolo', 'forest/mushroom', {
            roughness: 0.7,
            metalness: 0.0,
            // envMapIntensity: 0.46,
            castShadow: true,

            receivedShadow: true,
        });

        this.addPlantTexture('MushroomDuo', 'forest/mushroom', {
            roughness: 0.7,
            metalness: 0.0,
            // envMapIntensity: 0.46,
            castShadow: true,

            receivedShadow: true,
        });
        this.addPlantTexture('AnimalPaws', 'primary', {
            roughness: 0.96,
            // metalness: 0.4,
            // envMapIntensity: 0.25
        });

        // Rochers
        this.addTextureMapping('BigRock', 'rock', null, {
            roughness: 1.0,
            metalness: 0.05,
            envMapIntensity: 0.2,
            aoIntensity: 0.8
        });

        this.addTextureMapping('RockWater', 'rock', null, {
            roughness: 0.8,
            metalness: 0.1,
            envMapIntensity: 0.5
        });

        this.addTextureMapping('Ground', 'ground', 'ForestGrass', {
            roughness: 1.0,
            metalness: 0.0,
            envMapIntensity: 0.0
        });
        // Sol
        this.addTextureMapping('Ground', 'ground', 'ForestRoad', {
            roughness: 1.0,
            metalness: 0.0,
            envMapIntensity: 0.0
        });
        // this.addTextureForModel('Ground', 'alpha', '/textures/ground/ForestRoad_Alpha.png');
        // this.addTextureForModel('Ground', 'alpha', '/textures/ground/ForestRoad_Diff_road.png');
        // this.addTextureForModel('Ground', 'alpha', '/textures/ground/ForestRoad_Diff_grass.png');
        // this.addTextureForModel('Ground', 'opacity', '/textures/ground/ForestRoad_Alpha.png');
        // this.addTextureForModel('Ground', 'opacity', '/textures/ground/ForestRoad_Diff_road.png');
        // this.addTextureForModel('Ground', 'opacity', '/textures/ground/ForestRoad_Diff_grass.png');

// Ajouter explicitement les textures de chemin pour le mélange
        this.addTextureMapping('ForestRoad', 'ground', 'ForestRoad', {
            roughness: 0.9,  // Légèrement moins rugueux que l'herbe pour le chemin
            metalness: 0.0,
            envMapIntensity: 0.0
        });


        // Définition des groupes de matériaux pour la fusion
        this.defineMaterialGroups();
    }

    // Définir des groupes de matériaux qui peuvent être fusionnés
    defineMaterialGroups() {
        this.materialGroups = {
            'forest': ['TreeNaked', 'TrunkLarge', 'TrunkThin', 'TreeStump', 'TreeRoots'],
            'bushes': ['Bush', 'BushBlueberry', 'BushRaspberry', 'BushStrawberry', 'BushTrunk'],
            'plants': ['PlantPuccinellia', 'PlantReed', 'PlantMiscanthus', 'PlantClematis'],
            'flowers': ['FlowerBell', 'FlowerClover', 'FlowerChicory'],
            'mushrooms': ['MushroomSolo', 'MushroomDuo'],
            'rocks': ['BigRock', 'RockWater'],
            'ground': ['Ground']
        };

        // Créer la relation inverse pour une recherche rapide
        this.modelGroupMap = {};
        Object.entries(this.materialGroups).forEach(([group, models]) => {
            models.forEach(model => {
                this.modelGroupMap[model] = group;
            });
        });
    }

    // Méthodes pour définir et récupérer les propriétés du matériau
    setMaterialProperties(modelId, properties) {
        if (!modelId) {
            console.error("setMaterialProperties: modelId est requis");
            return this;
        }

        // S'assurer que materialProperties[modelId] existe
        if (!this.materialProperties[modelId]) {
            this.materialProperties[modelId] = {};
        }

        // Fusionner les propriétés
        this.materialProperties[modelId] = {
            ...this.defaultMaterialProperties,
            ...this.materialProperties[modelId],
            ...properties
        };

        // Si le matériau existe déjà dans le pool, mettre à jour ses propriétés
        // Utiliser cette approche pour éviter l'erreur de Object.keys()
        const materialKeys = [];
        for (const key in this.materialPool) {
            if (key.startsWith(modelId + '_')) {
                materialKeys.push(key);
            }
        }

        materialKeys.forEach(key => {
            const material = this.materialPool[key];
            if (material) {
                // Appliquer les nouvelles propriétés
                this._applyMaterialProperties(material, this.materialProperties[modelId]);
                material.needsUpdate = true;
                console.log(`Propriétés mises à jour pour le matériau existant ${key}`);
            }
        });

        return this;
    }

    getMaterialProperties(modelId) {
        return this.materialProperties[modelId] || this.defaultMaterialProperties;
    }

    // Applique les propriétés configurées au matériau
    _applyMaterialProperties(material, properties) {
        if (!material || !properties) return;

        // Appliquer les propriétés directement au matériau
        if (properties.roughness !== undefined) material.roughness = properties.roughness;
        if (properties.metalness !== undefined) material.metalness = properties.metalness;
        if (properties.envMapIntensity !== undefined && material.envMap) material.envMapIntensity = properties.envMapIntensity;
        if (properties.aoIntensity !== undefined && material.aoMap) material.aoMapIntensity = properties.aoIntensity;
        if (properties.normalScale !== undefined && material.normalMap) {
            if (!material.normalScale) material.normalScale = {x: 1, y: 1};
            material.normalScale.x = material.normalScale.y = properties.normalScale;
        }
        if (properties.displacementScale !== undefined && material.displacementMap) {
            material.displacementScale = properties.displacementScale;
        }
    }

    // Méthodes existantes préservées mais améliorées
    addTextureMapping(modelId, folder, filePrefix = null, materialProperties = null) {
        const prefix = filePrefix || modelId;

        this.texturePaths[modelId] = {
            baseColor: `/textures/${folder}/${prefix}_BaseColor.png`,
            normal: `/textures/${folder}/${prefix}_Normal.png`,
            normalOpenGL: `/textures/${folder}/${prefix}_NormalOpenGL.png`,
            roughness: `/textures/${folder}/${prefix}_Roughness.png`,
            metalness: `/textures/${folder}/${prefix}_Metallic.png`,
            height: `/textures/${folder}/${prefix}_Height.png`
        };

        if (this.isAlphaTextureAvailable(folder, prefix)) {
            this.texturePaths[modelId].alpha = `/textures/${folder}/${prefix}_Alpha.png`;
        }

        if (this.isOpacityTextureAvailable(folder, prefix)) {
            this.texturePaths[modelId].opacity = `/textures/${folder}/${prefix}_Opacity.png`;
        }

        // Stocker les propriétés du matériau si fournies
        if (materialProperties) {
            this.setMaterialProperties(modelId, materialProperties);
        }
    }

    addPlantTexture(modelId, folder, materialProperties = null) {
        this.texturePaths[modelId] = {
            baseColor: `/textures/${folder}/${modelId}_BaseColor.png`,
        };

        if (this.isAlphaTextureAvailable(folder, modelId)) {
            this.texturePaths[modelId].alpha = `/textures/${folder}/${modelId}_Alpha.png`;
        }

        // Créer des propriétés de matériau par défaut qui désactivent toutes les maps supplémentaires
        const defaultProperties = {
            roughness: 0,
            metalness: 0,
            normalMap: null,
            roughnessMap: null,
            metalnessMap: null,
            aoMap: null,
            envMap: null,
            side: DoubleSide,
            flatShading: true,
            needsUpdate: true,
            envMapIntensity: 0,
            aoMapIntensity: 0,
            normalScale: {x: 0, y: 0}
        };

        // Fusionner avec les propriétés personnalisées si fournies
        if (materialProperties) {
            this.setMaterialProperties(modelId, {...defaultProperties, ...materialProperties});
        } else {
            this.setMaterialProperties(modelId, defaultProperties);
        }
    }

    isAlphaTextureAvailable(folder, prefix) {
        // Liste des préfixes de dossiers qui peuvent avoir des textures alpha
        const alphaSupportedPrefixes = ['forest/', 'primary'];
        return alphaSupportedPrefixes.some(p => folder.startsWith(p));
    }

    isOpacityTextureAvailable(folder, prefix) {
        return folder === 'ground' && (prefix === 'ForestGrass' || prefix === 'ForestRoad');
    }

    getTexturePathsForModel(modelId) {
        return this.texturePaths[modelId] || null;
    }
    addRandomizedTexture(modelId, folder, options = {}) {
        const variantConfig = {
            // Configuration des variantes disponibles
            baseColor: ['TreeRoof_BaseColor.png', 'TreeRoofDark_BaseColor.png', 'TreeRoofMedium_BaseColor.png'],
            alpha: ['TreeRoof_Alpha.png', 'TreeRoof1_Alpha.png', 'TreeRoof2_Alpha.png', 'TreeRoof3_Alpha.png', 'TreeRoof4_Alpha.png', 'TreeRoof5_Alpha.png'],
            ...options
        };

        // Fonctions de sélection aléatoire
        const getRandomVariant = (variants) => {
            const index = Math.floor(Math.random() * variants.length);
            return variants[index];
        };

        // Sélectionner aléatoirement un BaseColor et un Alpha
        const selectedBaseColor = getRandomVariant(variantConfig.baseColor);
        const selectedAlpha = getRandomVariant(variantConfig.alpha);

        console.log(`Textures aléatoires pour ${modelId}: BaseColor=${selectedBaseColor}, Alpha=${selectedAlpha}`);

        // Créer un mappage de texture personnalisé
        this.texturePaths[modelId] = {
            baseColor: `/textures/${folder}/${selectedBaseColor}`,
            alpha: `/textures/${folder}/${selectedAlpha}`
        };

        // Stocker les propriétés du matériau si fournies
        const materialProperties = {
            roughness: 1.0,
            metalness: 0.0,
            envMapIntensity: 0.05,
            ...options.materialProperties
        };

        this.setMaterialProperties(modelId, materialProperties);

        // Stocker l'information sur les variantes pour référence future
        this.texturePaths[modelId].isRandomized = true;
        this.texturePaths[modelId].selectedVariants = {
            baseColor: selectedBaseColor,
            alpha: selectedAlpha
        };

        return this.texturePaths[modelId];
    }

    /**
     * Crée un matériau avec des textures aléatoires pour une instance spécifique
     * @param {string} modelId - Identifiant du modèle de base (par ex. 'TreeRoof')
     * @param {string} instanceId - Identifiant unique pour cette instance (ou null pour en générer un)
     * @param {Object} options - Options supplémentaires
     * @returns {Object} Le matériau créé
     */
    createRandomizedMaterial(modelId, instanceId = null, options = {}) {
        // Générer un ID d'instance si non fourni
        const uniqueId = instanceId || `${modelId}_${Math.floor(Math.random() * 10000)}`;

        // Créer un nouveau mappage de textures pour cette instance spécifique
        this.addRandomizedTexture(uniqueId, options.folder || 'forest/tree', options);

        // Créer un matériau avec ces textures
        const material = this.getMaterial(uniqueId, options);

        // Associer le matériau unique à cet ID pour pouvoir le retrouver
        this.materialPool[`random_${uniqueId}`] = material;

        return material;
    }

    /**
     * Applique des textures aléatoires à tous les meshes TreeRoof dans un modèle
     * @param {Object} modelObject - L'objet 3D contenant potentiellement des TreeRoof
     * @param {Object} options - Options supplémentaires
     * @returns {number} Nombre de meshes modifiés
     */
    applyRandomizedTreeRoofTextures(modelObject, options = {}) {
        if (!modelObject) return 0;

        let modifiedCount = 0;
        const textureInstances = new Map(); // Pour réutiliser les textures sur les objets proches

        modelObject.traverse((node) => {
            // Détecter les meshes qui pourraient être des toits d'arbres
            if (node.isMesh &&
                (node.name.includes('TreeRoof') ||
                    (node.parent && node.parent.name.includes('TreeRoof')))) {

                // Créer un identifiant pour ce nœud basé sur sa position générale
                // (les parties proches du même arbre auront le même ID de groupe)
                const groupX = Math.floor(node.position.x / 5);
                const groupY = Math.floor(node.position.y / 5);
                const groupZ = Math.floor(node.position.z / 5);
                const groupId = `group_${groupX}_${groupY}_${groupZ}`;

                let material;

                // Réutiliser le même matériau pour les parties proches du même arbre
                if (textureInstances.has(groupId)) {
                    material = textureInstances.get(groupId);
                } else {
                    // Créer un nouveau matériau randomisé
                    const instanceId = `TreeRoof_${groupId}`;
                    material = this.createRandomizedMaterial('TreeRoof', instanceId, {
                        folder: 'forest/tree',
                        materialProperties: {
                            roughness: 1.0,
                            metalness: 0.0,
                            envMapIntensity: 0.05,
                            ...options.materialProperties
                        }
                    });

                    // Stocker pour réutilisation
                    textureInstances.set(groupId, material);
                }

                // Appliquer le matériau
                node.material = material;
                modifiedCount++;
            }
        });

        console.log(`Textures TreeRoof randomisées appliquées à ${modifiedCount} meshes dans ${textureInstances.size} groupes`);
        return modifiedCount;
    }
    hasTextures(modelId) {
        return !!this.texturePaths[modelId];
    }

    addTextureForModel(modelId, textureType, texturePath) {
        if (!this.texturePaths[modelId]) {
            this.texturePaths[modelId] = {};
        }

        this.texturePaths[modelId][textureType] = texturePath;
        return this;
    }

    /**
     * Précharger une texture avec gestion de LOD et optimisation mémoire
     */
    async preloadTexture(texturePath) {
        if (typeof texturePath !== 'string') {
            console.error('preloadTexture: le chemin doit être une chaîne, reçu', typeof texturePath);
            return null;
        }

        // Vérifier si la texture est déjà en cache
        const cacheKey = `${texturePath}_${this.currentLOD}`;
        if (this.loadedTextures[cacheKey]) {
            return this.loadedTextures[cacheKey];
        }

        return new Promise((resolve, reject) => {
            try {
                const textureLoader = new TextureLoader();

                // Appliquer le facteur de LOD à la qualité de la texture
                const lodScale = this.textureResolutions[this.currentLOD];

                textureLoader.load(
                    texturePath,
                    (texture) => {
                        // Configuration standard pour les textures
                        texture.encoding = SRGBColorSpace;
                        texture.wrapS = RepeatWrapping;
                        texture.wrapT = RepeatWrapping;
                        texture.flipY = false;

                        // Réduire la résolution selon le LOD actuel
                        if (lodScale < 1.0) {
                            texture.minFilter = LinearFilter;
                            texture.magFilter = LinearFilter;
                            // Simuler une réduction de résolution en ajustant l'anisotropie
                            texture.anisotropy = Math.max(1, Math.floor(16 * lodScale));
                        }

                        // Stocker la taille originale pour les statistiques
                        const originalSize = (texture.image?.width || 0) * (texture.image?.height || 0) * 4; // Estimation en bytes
                        texture.userData.memorySize = originalSize * lodScale * lodScale;

                        // Mise à jour des statistiques
                        this.stats.texturesLoaded++;
                        this.stats.memoryUsage += texture.userData.memorySize / (1024 * 1024); // Conversion en MB

                        // Stocker dans le cache global
                        this.loadedTextures[cacheKey] = texture;
                        resolve(texture);
                    },
                    undefined,
                    (error) => {
                        // console.error(`Erreur lors du chargement de la texture ${texturePath}:`, error);
                        reject(error);
                    }
                );
            } catch (error) {
                console.error(`Exception lors du chargement de la texture ${texturePath}:`, error);
                reject(error);
            }
        });
    }

    // Précharger toutes les textures pour un modèle
    async preloadTexturesForModel(modelId) {
        const texturePaths = this.getTexturePathsForModel(modelId);
        if (!texturePaths) return null;

        const loadedTextures = {};
        const promises = [];

        // Parcourir tous les chemins de textures du modèle
        for (const [textureType, texturePath] of Object.entries(texturePaths)) {
            // Vérification de sécurité pour texturePath
            if (typeof texturePath === 'string') {
                const promise = this.preloadTexture(texturePath)
                    .then(texture => {
                        if (texture) {
                            loadedTextures[textureType] = texture;
                        }
                    })
                    .catch(error => {
                        // console.warn(`Échec du chargement de la texture ${textureType} pour ${modelId}:`, error);
                    });

                promises.push(promise);
            } else {
                // console.warn(`Chemin de texture invalide pour ${modelId}.${textureType}:`, texturePath);
            }
        }

        // Attendre que toutes les textures soient chargées
        await Promise.all(promises);
        return loadedTextures;
    }

    // Configurer une texture en fonction de son type
    configureTexture(texture, textureType) {
        if (!texture || typeof texture !== 'object' || !texture.isTexture) {
            console.warn(`configureTexture: texture invalide pour le type ${textureType}`, texture);
            return;
        }

        // Configuration spécifique selon le type de texture
        switch (textureType) {
            case 'baseColor':
            case 'diffuse':
                texture.encoding = SRGBColorSpace;
                break;
            case 'normal':
            case 'normalOpenGL':
            case 'roughness':
            case 'metalness':
            case 'ao':
            case 'height':
            case 'alpha':
            case 'opacity':
                texture.encoding = LinearEncoding;
                break;
        }

        // Configuration commune
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.needsUpdate = true;
    }

    /**
     * Créer ou récupérer un matériau du pool de matériaux
     * Version améliorée avec support pour le LOD et la fusion
     */
    getMaterial(modelId, options = {}) {
        // Identifier le groupe de matériaux
        const group = this.modelGroupMap[modelId] || 'default';

        // Créer une clé qui reflète le LOD actuel et options
        const optionsWithLOD = {...options, lod: options.lod || this.currentLOD};
        const key = this._getMaterialKey(modelId, optionsWithLOD);
        const groupKey = `group_${group}_${JSON.stringify(optionsWithLOD)}`;

        // Vérifier si une fusion est disponible pour ce groupe et ces options
        if (options.useGroupMaterial && this.materialPool[groupKey]) {
            return this.materialPool[groupKey];
        }

        // Si le matériau spécifique existe déjà dans le pool, le retourner
        if (this.materialPool[key]) {
            return this.materialPool[key];
        }

        // Récupérer les propriétés du matériau pour ce modèle
        const materialProperties = this.getMaterialProperties(modelId);

        // Sinon, créer un nouveau matériau
        const material = new MeshStandardMaterial({
            name: `${modelId}_material`,
            side: DoubleSide,
            transparent: true,
            alphaTest: 0.5,
            // Appliquer directement les propriétés spécifiques
            roughness: materialProperties.roughness,
            metalness: materialProperties.metalness
        });

        // console.log(`Création d'un nouveau matériau pour ${modelId} avec options:`, optionsWithLOD);
        // console.log(`Propriétés appliquées: roughness=${materialProperties.roughness}, metalness=${materialProperties.metalness}`);
        this.stats.materialsCreated++;

        // Précharger et appliquer les textures de manière asynchrone
        this.preloadTexturesForModel(modelId)
            .then(textures => {
                if (textures) {
                    this._applyTexturesToMaterial(material, textures, {
                        ...optionsWithLOD,
                        ...materialProperties,  // Inclure les propriétés spécifiques du matériau
                        modelId: modelId
                    });
                    // console.log(`Textures appliquées au matériau ${modelId}`);

                    // Si ce matériau est le premier pour son groupe, l'utiliser aussi comme matériau de groupe
                    if (options.useGroupMaterial && group && !this.materialPool[groupKey]) {
                        this.materialPool[groupKey] = material;
                        // console.log(`Matériau de référence créé pour le groupe ${group}`);
                    }
                }
            })
            .catch(error => {
                console.error(`Erreur lors du chargement des textures pour ${modelId}:`, error);
            });

        // Stocker dans le pool et retourner immédiatement (les textures seront appliquées plus tard)
        this.materialPool[key] = material;
        return material;
    }

    // Générer une clé unique pour le matériau basée sur ses propriétés
    _getMaterialKey(modelId, options) {
        const optionsKey = JSON.stringify(options);
        return `${modelId}_${optionsKey}`;
    }



    /**
     * Méthode utilitaire pour calculer la distance d'un point à un segment
     * Utilisé par createPathOnGround
     */
    _distanceToSegment(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;

        return Math.sqrt(dx * dx + dy * dy);
    }


    // Version privée de applyTexturesToMaterial pour usage interne
    _applyTexturesToMaterial(material, textures, options = {}) {
        if (!material || !textures) return;
        // Récupérer les propriétés spécifiques du matériau
        const materialProps = this.getMaterialProperties(options.modelId || '');

        // Configuration par défaut avec LOD et propriétés spécifiques
        const config = {
            aoIntensity: materialProps.aoIntensity || 0.5,
            useDisplacement: false,
            displacementScale: materialProps.displacementScale || 0.05,
            useEnvMap: true,
            envMapIntensity: materialProps.envMapIntensity || 0.5,
            normalScale: materialProps.normalScale || 1.0,
            roughness: materialProps.roughness,
            metalness: materialProps.metalness,
            lod: this.currentLOD,
            ...options
        };

        try {
            if (material.color) {
                material.userData.originalDefineColor = material.defines?.USE_COLOR;
                material.defines = material.defines || {};
                material.defines.USE_COLOR = false;
            }

            // Application des textures suivant le LOD
            // Pour le LOD bas, désactiver certaines textures complexes
            const applyDetailedTextures = config.lod !== 'low';

            // Carte de couleur de base (BaseColor/Diffuse) - toujours appliquée
            if (textures.baseColor) {
                material.map = textures.baseColor;
                this.configureTexture(material.map, 'baseColor');
            } else if (textures.diffuse) {
                material.map = textures.diffuse;
                this.configureTexture(material.map, 'diffuse');
            }

            // Cartes détaillées - appliquées seulement si le LOD le permet
            if (applyDetailedTextures) {
                // Carte normale
                if (textures.normalOpenGL) {
                    material.normalMap = textures.normalOpenGL;
                    this.configureTexture(material.normalMap, 'normalOpenGL');
                    material.normalScale = {x: config.normalScale, y: config.normalScale};
                } else if (textures.normal) {
                    material.normalMap = textures.normal;
                    this.configureTexture(material.normalMap, 'normal');
                    material.normalScale = {x: config.normalScale, y: config.normalScale};
                }

                // Carte de rugosité
                if (textures.roughness) {
                    material.roughnessMap = textures.roughness;
                    this.configureTexture(material.roughnessMap, 'roughness');
                    // Appliquer la valeur de roughness configurée
                    material.roughness = config.roughness !== undefined ? config.roughness : 1.0;
                } else if (config.roughness !== undefined) {
                    material.roughness = config.roughness;
                }

                // Carte de métallicité
                if (textures.metalness) {
                    material.metalnessMap = textures.metalness;
                    this.configureTexture(material.metalnessMap, 'metalness');
                    // Appliquer la valeur de metalness configurée
                    material.metalness = config.metalness !== undefined ? config.metalness : 0.0;
                } else if (config.metalness !== undefined) {
                    material.metalness = config.metalness;
                }

                // Carte d'occlusion ambiante
                if (textures.ao) {
                    material.aoMap = textures.ao;
                    this.configureTexture(material.aoMap, 'ao');
                    material.aoMapIntensity = config.aoIntensity;
                } else if (textures.height && !config.useDisplacement) {
                    material.aoMap = textures.height;
                    this.configureTexture(material.aoMap, 'height');
                    material.aoMapIntensity = config.aoIntensity;
                }

                // Gestion de la height map - uniquement pour LOD high
                if (config.lod === 'high' && textures.height && config.useDisplacement) {
                    material.displacementMap = textures.height;
                    this.configureTexture(material.displacementMap, 'height');
                    material.displacementScale = config.displacementScale;
                }
            } else {
                // Pour le LOD bas, utiliser des valeurs fixes plutôt que des textures
                material.roughness = config.roughness !== undefined ? config.roughness : 0.8;
                material.metalness = config.metalness !== undefined ? config.metalness : 0.1;
            }

            // Carte de transparence (Alpha ou Opacity) - importante pour tous les LOD
            if (textures.alpha) {
                material.alphaMap = textures.alpha;
                this.configureTexture(material.alphaMap, 'alpha');
                material.transparent = true;
                material.alphaTest = 0.5;

                material.side = DoubleSide;

                // Débogage spécifique pour TreeRoof
                if (options.modelId === 'TreeRoof') {
                    console.log("Application spécifique de Alpha pour TreeRoof:", textures.alpha);
                    console.log("Configuration matériau TreeRoof:", material);
                }
            } else if (textures.opacity) {
                material.alphaMap = textures.opacity;
                this.configureTexture(material.alphaMap, 'opacity');
                material.transparent = true;
                material.alphaTest = 0.5;
            }
// Ajout de l'environnement mapping - seulement pour les LOD medium et high
            if (config.useEnvMap && config.lod !== 'low') {
                const envMapTexture = window.assetManager?.getItem('EnvironmentMap');
                if (envMapTexture) {
                    material.envMap = envMapTexture;
                    material.envMapIntensity = config.envMapIntensity *
                        (config.lod === 'high' ? 1.0 : 0.5); // Réduire l'intensité pour medium
                    material.needsUpdate = true;
                    // console.log(`EnvMap appliquée avec une intensité de ${material.envMapIntensity}`);
                }
            }

            // Mettre à jour le matériau
            material.needsUpdate = true;
        } catch (error) {
            console.error("Erreur lors de l'application des textures au matériau:", error);
        }
    }

    /**
     * Configure le terrain en utilisant la profondeur des vertices pour déterminer la texture
     * @param {Object} groundObject - L'objet 3D du terrain
     * @param {Object} options - Options de configuration
     * @returns {Boolean} - true si la configuration a réussi
     */
    async setupGroundWithDepthBasedTexturing(groundObject, options = {}) {
        if (!groundObject) {
            console.error("setupGroundWithDepthBasedTexturing: objet terrain manquant");
            return false;
        }

        console.log("REDIRECTION: Utilisation de la méthode basée uniquement sur la hauteur");

        // Rediriger vers notre nouvelle méthode simplifiée
        return this.setupGroundBasedOnHeight(groundObject, {
            heightThreshold: 0.63,
            transitionZone: 0.02,
            invertHeight: false,
            yOffset: 0.5
        });
    }

    /**
     * Vérifie si un point est proche d'un chemin défini par des points
     * @param {Number} x - Coordonnée X du point
     * @param {Number} z - Coordonnée Z du point
     * @param {Array} path - Tableau de points définissant le chemin
     * @param {Number} width - Largeur du chemin
     * @returns {Boolean} - true si le point est proche du chemin
     */
    _isPointNearPath(x, z, path, width = 2.0) {
        // Vérifier si le chemin a des points
        if (!path || !path.points || path.points.length < 2) return false;

        // Pour chaque segment du chemin
        for (let i = 0; i < path.points.length - 1; i++) {
            const [x1, z1] = path.points[i];
            const [x2, z2] = path.points[i + 1];

            // Calculer la distance du point au segment
            const distance = this._distanceToSegment(x, z, x1, z1, x2, z2);

            // Si la distance est inférieure à la moitié de la largeur, le point est sur le chemin
            if (distance <= width / 2) {
                return true;
            }
        }

        return false;
    }

    /**
     * Méthode clé: Applique un matériau fusionné à un modèle déjà chargé/instancié
     * Cette méthode est le cœur de l'optimisation pour les modèles existants
     */
    applyMergedMaterialToModel(modelObject, options = {}) {
        if (!modelObject) return null;

        // Configurations par défaut pour la fusion
        const config = {
            forceMerge: false,              // Forcer la fusion même s'il n'y a qu'une instance
            useGroupMaterial: true,         // Utiliser le matériau de groupe si disponible
            preserveVertexColors: true,     // Préserver les couleurs de vertex si présentes
            optimizeGeometry: true,         // Optimiser la géométrie (enlever les faces cachées, etc.)
            mergeSimilarMaterials: this.optimizationConfig.materialMergeEnabled, // Fusionner les matériaux similaires
            useCustomProperties: true,      // Utiliser les propriétés personnalisées du matériau
            ...options
        };

        // Analyser l'objet pour identifier son type et ses caractéristiques
        const modelInfo = this.analyzeModel(modelObject);

        if (!modelInfo.modelId) {
            console.warn("Impossible d'identifier le modèle pour la fusion de matériaux");
            return null;
        }

        // Obtenir l'ID du groupe si disponible
        const group = this.modelGroupMap[modelInfo.modelId] || 'default';

        // Suivre cette instance
        this.trackInstance(modelInfo.modelId, modelObject);

        // Vérifier si une fusion est nécessaire
        const shouldMerge = config.forceMerge ||
            this.instanceTracker[modelInfo.modelId]?.count > this.optimizationConfig.mergeThreshold;

        if (shouldMerge || config.useGroupMaterial) {
            // Obtenir le matériau approprié (spécifique ou de groupe)
            const materialOptions = {
                useGroupMaterial: config.useGroupMaterial,
                lod: this.determineLODForObject(modelObject),
                modelId: modelInfo.modelId
            };

            const material = this.getMaterial(modelInfo.modelId, materialOptions);

            // Appliquer le matériau fusionné à tous les mesh de l'objet
            this.applyMaterialToAllMeshes(modelObject, material, config);

            // Mettre à jour les statistiques
            this.stats.instancesMerged++;

            return material;
        } else {
            // Utiliser la méthode standard si pas de fusion
            return this.applyTexturesToModel(modelInfo.modelId, modelObject, options);
        }
    }

    /**
     * Analyser un modèle pour identifier ses caractéristiques
     */
    analyzeModel(modelObject) {
        const result = {
            modelId: null,
            meshCount: 0,
            vertexCount: 0,
            hasVertexColors: false,
            materialTypes: new Set(),
            geometryTypes: new Set()
        };

        // Identifier le modelId à partir du nom
        if (modelObject.name) {
            // Essayer d'extraire l'ID du modèle à partir du nom
            const knownIds = Object.keys(this.texturePaths);
            for (const id of knownIds) {
                if (modelObject.name.includes(id)) {
                    result.modelId = id;
                    break;
                }
            }

            // Si aucun ID n'est trouvé, essayer d'extraire le modèle de base
            if (!result.modelId) {
                result.modelId = this.extractBaseModelId(modelObject.name);
            }
        }

        // Si toujours pas d'ID, utiliser un ID générique basé sur le type d'objet
        if (!result.modelId) {
            result.modelId = 'Generic' + (modelObject.type || 'Model');
        }

        // Analyser récursivement pour collecter des statistiques
        modelObject.traverse((node) => {
            if (node.isMesh) {
                result.meshCount++;

                if (node.geometry) {
                    result.vertexCount += node.geometry.attributes.position?.count || 0;
                    result.hasVertexColors = !!node.geometry.attributes.color;
                    result.geometryTypes.add(node.geometry.type);
                }

                if (node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    materials.forEach(mat => {
                        result.materialTypes.add(mat.type);
                    });
                }
            }
        });

        return result;
    }

    /**
     * Suivre les instances de modèles
     */
    trackInstance(modelId, modelObject) {
        if (!this.instanceTracker[modelId]) {
            this.instanceTracker[modelId] = {
                count: 0,
                instances: new Set(),
                lastMergeCheck: Date.now()
            };
        }

        this.instanceTracker[modelId].count++;
        this.instanceTracker[modelId].instances.add(modelObject.uuid);

        // Vérifier si une optimisation est nécessaire
        if (this.optimizationConfig.autoMergeEnabled &&
            this.instanceTracker[modelId].count % this.optimizationConfig.mergeThreshold === 0) {
            this.checkAndOptimizeInstances(modelId);
        }
    }

    /**
     * Déterminer le LOD approprié en fonction de la distance
     */
    determineLODForObject(object) {
        // Par défaut, utiliser le LOD global
        if (!object || !object.position) return this.currentLOD;

        // Calculer la distance à la caméra si disponible
        const camera = window.camera || null;
        if (!camera || !camera.position) return this.currentLOD;

        const distance = object.position.distanceTo(camera.position);

        // Ajuster le LOD en fonction de la distance
        if (distance <= this.optimizationConfig.distanceThresholds.high) {
            return 'high';
        } else if (distance <= this.optimizationConfig.distanceThresholds.medium) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Appliquer un matériau à tous les Mesh d'un objet
     * Version améliorée avec support pour les propriétés personnalisées
     */
    applyMaterialToAllMeshes(object, material, config = {}) {
        // Suivre l'état de fusion des matériaux pour les statistiques
        let materialsMerged = 0;

        // Collection pour stocker temporairement les matériaux similaires
        const similarMaterials = {};

        object.traverse((node) => {
            if (node.isMesh) {
                const originalMaterial = node.material;

                // Préserver les couleurs de vertex si demandé et présentes
                if (config.preserveVertexColors &&
                    node.geometry?.attributes?.color &&
                    material.vertexColors !== true) {

                    // Cloner le matériau pour ce mesh spécifique afin de préserver les couleurs
                    const clonedMaterial = material.clone();
                    clonedMaterial.vertexColors = true;

                    // Appliquer les propriétés personnalisées au clone si disponibles
                    if (config.useCustomProperties && config.modelId) {
                        const props = this.getMaterialProperties(config.modelId);
                        this._applyMaterialProperties(clonedMaterial, props);
                    }

                    node.material = clonedMaterial;
                } else if (config.mergeSimilarMaterials && originalMaterial) {
                    // Option avancée: fusion intelligente de matériaux similaires
                    const materialSignature = this._getMaterialSignature(originalMaterial);

                    if (similarMaterials[materialSignature]) {
                        // Si un matériau similaire a déjà été traité, le réutiliser
                        node.material = similarMaterials[materialSignature];
                        materialsMerged++;
                    } else {
                        // Si c'est le premier de ce type, l'utiliser comme référence
                        // mais après optimisation
                        const optimizedMaterial = this._optimizeMaterial(originalMaterial, material);

                        // Appliquer les propriétés personnalisées si disponibles
                        if (config.useCustomProperties && config.modelId) {
                            const props = this.getMaterialProperties(config.modelId);
                            this._applyMaterialProperties(optimizedMaterial, props);
                        }

                        node.material = optimizedMaterial;
                        similarMaterials[materialSignature] = optimizedMaterial;
                    }
                } else {
                    // Appliquer directement le matériau partagé
                    node.material = material;
                    materialsMerged++;
                }

                // Optimiser la géométrie si demandé
                if (config.optimizeGeometry && node.geometry) {
                    // Activer les UV2 pour l'aoMap si nécessaire
                    if (!node.geometry.attributes.uv2 && node.geometry.attributes.uv) {
                        node.geometry.setAttribute('uv2', node.geometry.attributes.uv);
                    }

                    // Optimisations supplémentaires pour la géométrie
                    if (!node.geometry.boundingSphere) {
                        node.geometry.computeBoundingSphere();
                    }

                    if (!node.geometry.boundingBox) {
                        node.geometry.computeBoundingBox();
                    }

                    // Centrer les attributs de la géométrie pour améliorer les performances
                    if (node.geometry.attributes.position && node.geometry.attributes.position.usage === StaticDrawUsage) {
                        node.geometry.attributes.position.needsUpdate = true;
                    }
                }
            }
        });

        // Mettre à jour les statistiques de fusion
        this.stats.materialsMerged += materialsMerged;

        if (materialsMerged > 0) {
            console.log(`Fusion de matériaux: ${materialsMerged} matériaux remplacés dans le modèle ${object.name || 'sans nom'}`);
        }
    }

    /**
     * Comparer deux matériaux pour déterminer s'ils sont similaires
     * et pourraient être fusionnés
     */
    _areMaterialsSimilar(materialA, materialB) {
        if (!materialA || !materialB) return false;

        // Si les types sont différents, ils ne sont pas similaires
        if (materialA.type !== materialB.type) return false;

        // Vérifier les propriétés de base
        const basicSimilarity =
            materialA.transparent === materialB.transparent &&
            materialA.side === materialB.side &&
            materialA.alphaTest === materialB.alphaTest;

        if (!basicSimilarity) return false;

        // Vérifier les textures principales
        const texturesSimilarity =
            (!!materialA.map === !!materialB.map) &&
            (!!materialA.normalMap === !!materialB.normalMap) &&
            (!!materialA.alphaMap === !!materialB.alphaMap);

        if (!texturesSimilarity) return false;

        // Si les deux matériaux ont une carte de couleur, vérifier si les couleurs sont proches
        if (materialA.color && materialB.color) {
            const colorDistance = Math.sqrt(
                Math.pow(materialA.color.r - materialB.color.r, 2) +
                Math.pow(materialA.color.g - materialB.color.g, 2) +
                Math.pow(materialA.color.b - materialB.color.b, 2)
            );

            // Seuil de distance de couleur
            if (colorDistance > 0.2) return false;
        }

        // Vérifier également la similarité des propriétés personnalisées
        const propertiesSimilarity =
            Math.abs(materialA.roughness - materialB.roughness) < 0.2 &&
            Math.abs(materialA.metalness - materialB.metalness) < 0.2 &&
            (!materialA.envMap || !materialB.envMap || Math.abs(materialA.envMapIntensity - materialB.envMapIntensity) < 0.3);

        if (!propertiesSimilarity) return false;

        // Si toutes les vérifications précédentes ont réussi
        return true;
    }

    /**
     * Générer une signature unique pour un matériau
     * utilisée pour regrouper les matériaux similaires
     */
    _getMaterialSignature(material) {
        if (!material) return 'null';

        // Créer une signature basée sur les propriétés clés
        const signature = {
            type: material.type,
            transparent: material.transparent,
            side: material.side,
            alphaTest: material.alphaTest,
            hasMap: !!material.map,
            hasNormalMap: !!material.normalMap,
            hasAlphaMap: !!material.alphaMap,
            hasAoMap: !!material.aoMap,
            roughnessGroup: Math.floor(material.roughness * 10) / 10, // Arrondir à 0.1 près
            metalnessGroup: Math.floor(material.metalness * 10) / 10, // Arrondir à 0.1 près
            envMapIntensityGroup: material.envMap ? Math.floor(material.envMapIntensity * 5) / 5 : 'none', // Arrondir à 0.2 près
            color: material.color ? `${material.color.r.toFixed(2)}_${material.color.g.toFixed(2)}_${material.color.b.toFixed(2)}` : 'none'
        };

        return JSON.stringify(signature);
    }

    /**
     * Optimiser un matériau existant en le fusionnant avec le matériau de référence
     */
    _optimizeMaterial(originalMaterial, referenceMaterial) {
        // Si le matériau original est déjà optimisé, le retourner
        if (originalMaterial.userData && originalMaterial.userData.isOptimized) {
            return originalMaterial;
        }

        // Si les matériaux sont très similaires, utiliser directement la référence
        const similarity = this._calculateMaterialSimilarity(originalMaterial, referenceMaterial);
        if (similarity > this.optimizationConfig.materialSimilarityThreshold) {
            return referenceMaterial;
        }

        // Sinon, créer un nouveau matériau basé sur l'original mais avec des optimisations
        const optimizedMaterial = originalMaterial.clone();

        // Conserver les propriétés visuelles importantes
        if (originalMaterial.map) {
            optimizedMaterial.map = originalMaterial.map;
        }

        if (originalMaterial.color) {
            optimizedMaterial.color = originalMaterial.color.clone();
        }

        if (originalMaterial.alphaMap) {
            optimizedMaterial.alphaMap = originalMaterial.alphaMap;
            optimizedMaterial.transparent = true;
        }

        // Conserver aussi les propriétés personnalisées de l'original
        optimizedMaterial.roughness = originalMaterial.roughness;
        optimizedMaterial.metalness = originalMaterial.metalness;
        if (originalMaterial.envMap) {
            optimizedMaterial.envMap = originalMaterial.envMap;
            optimizedMaterial.envMapIntensity = originalMaterial.envMapIntensity;
        }

        // Désactiver les maps moins importantes pour le LOD bas
        if (this.currentLOD === 'low') {
            optimizedMaterial.normalMap = null;
            optimizedMaterial.roughnessMap = null;
            optimizedMaterial.metalnessMap = null;
            optimizedMaterial.aoMap = null;
        } else {
            // Pour LOD moyen/élevé, garder les maps importantes
            if (originalMaterial.normalMap) {
                optimizedMaterial.normalMap = originalMaterial.normalMap;
            }

            if (originalMaterial.aoMap) {
                optimizedMaterial.aoMap = originalMaterial.aoMap;
            }
        }

        // Marquer comme optimisé
        optimizedMaterial.userData = optimizedMaterial.userData || {};
        optimizedMaterial.userData.isOptimized = true;
        optimizedMaterial.userData.originalUuid = originalMaterial.uuid;

        // Forcer la mise à jour
        optimizedMaterial.needsUpdate = true;

        return optimizedMaterial;
    }

    /**
     * Calculer un score de similarité entre deux matériaux (0-1)
     */
    _calculateMaterialSimilarity(materialA, materialB) {
        if (!materialA || !materialB) return 0;

        let score = 0;
        let totalFactors = 0;

        // Type de matériau - facteur important
        if (materialA.type === materialB.type) {
            score += 0.3;
        }
        totalFactors += 0.3;

        // Propriétés de rendu
        if (materialA.transparent === materialB.transparent) score += 0.1;
        totalFactors += 0.1;

        if (materialA.side === materialB.side) score += 0.05;
        totalFactors += 0.05;

        if (Math.abs(materialA.alphaTest - materialB.alphaTest) < 0.1) score += 0.05;
        totalFactors += 0.05;

        // Textures
        if ((!!materialA.map === !!materialB.map)) score += 0.1;
        totalFactors += 0.1;

        if ((!!materialA.normalMap === !!materialB.normalMap)) score += 0.05;
        totalFactors += 0.05;

        if ((!!materialA.alphaMap === !!materialB.alphaMap)) score += 0.1;
        totalFactors += 0.1;

        // Propriétés des matériaux personnalisées
        if (Math.abs(materialA.roughness - materialB.roughness) < 0.2) score += 0.1;
        totalFactors += 0.1;

        if (Math.abs(materialA.metalness - materialB.metalness) < 0.2) score += 0.1;
        totalFactors += 0.1;

        if (materialA.envMap && materialB.envMap &&
            Math.abs(materialA.envMapIntensity - materialB.envMapIntensity) < 0.3) {
            score += 0.1;
        }
        totalFactors += 0.1;

        // Couleur - facteur important si les deux ont une couleur
        if (materialA.color && materialB.color) {
            const colorDistance = Math.sqrt(
                Math.pow(materialA.color.r - materialB.color.r, 2) +
                Math.pow(materialA.color.g - materialB.color.g, 2) +
                Math.pow(materialA.color.b - materialB.color.b, 2)
            );

            // Convertir la distance en score (0-0.25)
            // Plus la distance est petite, plus le score est élevé
            const colorScore = Math.max(0, 0.25 - colorDistance);
            score += colorScore;
            totalFactors += 0.25;
        }

        // Normaliser le score
        return totalFactors > 0 ? score / totalFactors : 0;
    }

    /**
     * Version améliorée: Appliquer les textures à un modèle
     * avec support pour la fusion et le LOD
     */
    async applyTexturesToModel(modelId, modelObject, options = {}) {
        if (!modelObject) return;

        // Traitement spécial pour les modèles déjà instanciés
        if (options.optimizeInstances) {
            return this.applyMergedMaterialToModel(modelObject, options);
        }

        // Essayer de trouver des textures basées sur le nom du modèle si non définies
        if (!this.hasTextures(modelId)) {
            const baseModelId = this.extractBaseModelId(modelId);
            if (baseModelId && baseModelId !== modelId && this.hasTextures(baseModelId)) {
                console.log(`Utilisation des textures de ${baseModelId} pour ${modelId}`);
                modelId = baseModelId;
            } else {
                console.warn(`Aucune texture trouvée pour le modèle ${modelId} ou un modèle similaire`);
                return;
            }
        }

        // Ajouter le niveau de LOD actuel aux options
        const optionsWithLOD = {
            ...options,
            lod: options.lod || this.determineLODForObject(modelObject),
            modelId: modelId // Ajouter l'ID du modèle pour accéder aux propriétés personnalisées
        };

        // Récupérer ou créer un matériau partagé
        const material = this.getMaterial(modelId, optionsWithLOD);

        // Appliquer les propriétés du matériau spécifiques à ce modèle
        const materialProps = this.getMaterialProperties(modelId);
        if (materialProps && !options.skipCustomProperties) {
            this._applyMaterialProperties(material, materialProps);
            console.log(`Propriétés personnalisées appliquées au matériau pour ${modelId}:`,
                `roughness=${materialProps.roughness}, metalness=${materialProps.metalness}, envMapIntensity=${materialProps.envMapIntensity}`);
        }

        // Parcourir tous les matériaux du modèle
        modelObject.traverse((node) => {
            if (node.isMesh && node.material) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];

                // Remplacer tous les matériaux par notre matériau partagé
                if (Array.isArray(node.material)) {
                    for (let i = 0; i < node.material.length; i++) {
                        // Préserver les matériaux spéciaux si nécessaire
                        if (options.preserveSpecialMaterials &&
                            (node.material[i].userData.isSpecial || node.material[i].name?.includes('Special'))) {
                            continue;
                        }
                        node.material[i] = material;
                    }
                } else {
                    // Préserver les matériaux spéciaux si nécessaire
                    if (!(options.preserveSpecialMaterials &&
                        (node.material.userData.isSpecial || node.material.name?.includes('Special')))) {
                        node.material = material;
                    }
                }

                // Activer les UV2 pour l'aoMap si nécessaire
                if (node.geometry &&
                    !node.geometry.attributes.uv2 &&
                    node.geometry.attributes.uv) {
                    node.geometry.setAttribute('uv2', node.geometry.attributes.uv);
                }
            }
        });

        // Suivre cette instance
        this.trackInstance(modelId, modelObject);

        console.log(`Matériau appliqué au modèle ${modelId} avec LOD ${optionsWithLOD.lod}`);
    }

    /**
     * Mettre à jour les propriétés d'un matériau pour un modèle spécifique
     * Cette méthode permet de modifier les propriétés en cours d'exécution
     */
    updateMaterialProperties(modelId, properties = {}) {
        // Mettre à jour les propriétés dans la configuration
        this.setMaterialProperties(modelId, properties);

        // Récupérer les clés des matériaux pour ce modèle
        const materialKeys = Object.keys(this.materialPool).filter(key => key.startsWith(modelId + '_'));

        if (materialKeys.length === 0) {
            console.log(`Aucun matériau trouvé pour ${modelId}, les propriétés seront appliquées lors de la prochaine création`);
            return false;
        }

        // Appliquer les nouvelles propriétés à tous les matériaux existants
        let updatedCount = 0;
        materialKeys.forEach(key => {
            const material = this.materialPool[key];
            if (material) {
                this._applyMaterialProperties(material, properties);
                material.needsUpdate = true;
                updatedCount++;
            }
        });

        console.log(`Propriétés mises à jour pour ${updatedCount} matériaux de ${modelId}`);
        return updatedCount > 0;
    }

    /**
     * Mettre à jour une propriété spécifique pour tous les matériaux d'un modèle
     */
    updateMaterialProperty(modelId, property, value) {
        return this.updateMaterialProperties(modelId, {[property]: value});
    }

    /**
     * Interface simplifiée pour mettre à jour la rugosité d'un matériau
     */
    setRoughness(modelId, value) {
        return this.updateMaterialProperty(modelId, 'roughness', value);
    }

    /**
     * Interface simplifiée pour mettre à jour la métallicité d'un matériau
     */
    setMetalness(modelId, value) {
        return this.updateMaterialProperty(modelId, 'metalness', value);
    }

    /**
     * Interface simplifiée pour mettre à jour l'intensité de l'environnement
     */
    setEnvMapIntensity(modelId, value) {
        return this.updateMaterialProperty(modelId, 'envMapIntensity', value);
    }

    /**
     * Afficher les propriétés des matériaux pour tous les modèles
     */
    logMaterialProperties() {
        console.log("===== PROPRIÉTÉS DES MATÉRIAUX =====");

        // Afficher les propriétés par défaut
        console.log("Propriétés par défaut:");
        console.log(JSON.stringify(this.defaultMaterialProperties, null, 2));

        // Afficher les propriétés personnalisées par modèle
        console.log("\nPropriétés personnalisées par modèle:");
        Object.entries(this.materialProperties).forEach(([modelId, props]) => {
            console.log(`- ${modelId}: roughness=${props.roughness}, metalness=${props.metalness}, envMapIntensity=${props.envMapIntensity}`);
        });

        // Afficher les valeurs effectives des matériaux dans le pool
        console.log("\nValeurs effectives des matériaux dans le pool:");
        const modelMaterials = {};

        // Regrouper les matériaux par modèle
        Object.entries(this.materialPool).forEach(([key, material]) => {
            if (!key.includes('_')) return; // Ignorer les clés non-standard

            const modelId = key.split('_')[0];
            if (!modelMaterials[modelId]) {
                modelMaterials[modelId] = [];
            }

            modelMaterials[modelId].push({
                key: key,
                roughness: material.roughness,
                metalness: material.metalness,
                envMapIntensity: material.envMapIntensity
            });
        });

        // Afficher les valeurs
        Object.entries(modelMaterials).forEach(([modelId, materials]) => {
            if (materials.length > 0) {
                const sample = materials[0];
                console.log(`- ${modelId}: ${materials.length} matériaux, exemple: roughness=${sample.roughness}, metalness=${sample.metalness}, envMapIntensity=${sample.envMapIntensity}`);
            }
        });

        console.log("======================================");
    }

    // Méthode de diagnostic pour aider au débogage
    logTextureStats() {
        console.log("===== STATISTIQUES TEXTURE MANAGER =====");
        console.log(`Nombre de types d'objets avec textures: ${Object.keys(this.texturePaths).length}`);
        console.log(`Nombre de textures chargées en mémoire: ${Object.keys(this.loadedTextures).length}`);
        console.log(`Nombre de matériaux dans le pool: ${Object.keys(this.materialPool).length}`);
        console.log(`LOD actuel: ${this.currentLOD}`);
        console.log(`Instances suivies: ${Object.keys(this.instanceTracker).length} types de modèles`);
        console.log(`Total des instances: ${Object.values(this.instanceTracker).reduce((sum, tracker) => sum + tracker.count, 0)}`);
        console.log(`Matériaux fusionnés: ${this.stats.materialsMerged}`);
        console.log(`Instances fusionnées: ${this.stats.instancesMerged}`);
        console.log(`Utilisation mémoire estimée: ${this.stats.memoryUsage.toFixed(2)} MB`);

        if (this.stats.lastOptimization) {
            const timeSinceOpt = Math.floor((Date.now() - this.stats.lastOptimization) / 1000);
            console.log(`Dernière optimisation: il y a ${timeSinceOpt} secondes`);
        }

        // Liste des textures les plus utilisées
        const textureUsage = {};
        for (const material of Object.values(this.materialPool)) {
            if (material.map) {
                const path = material.map.source?.data?.src;
                if (path) {
                    textureUsage[path] = (textureUsage[path] || 0) + 1;
                }
            }
        }

        console.log("Top 5 des textures les plus utilisées:");
        Object.entries(textureUsage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([path, count]) => {
                console.log(`- ${path}: ${count} utilisations`);
            });

        console.log("======================================");
    }

    /**
     * Analyser les performances et suggérer des optimisations
     */
    analyzePerfAndSuggestOptimizations() {
        console.log("===== ANALYSE DE PERFORMANCE =====");

        // Analyse des matériaux
        const materialCount = Object.keys(this.materialPool).length;
        const textureCount = Object.keys(this.loadedTextures).length;
        const avgTexturesPerMaterial = textureCount / Math.max(1, materialCount);

        console.log(`Ratio textures/matériaux: ${avgTexturesPerMaterial.toFixed(2)}`);

        // Suggestions basées sur l'analyse
        const suggestions = [];

        if (avgTexturesPerMaterial > 3) {
            suggestions.push("Réduire le nombre de textures par matériau pour les objets distants");
        }

        if (this.stats.memoryUsage > this.optimizationConfig.memoryBudget * 0.8) {
            suggestions.push("Réduire la résolution des textures ou passer à un LOD plus bas");
        }

        // Identifier les modèles qui pourraient bénéficier d'une fusion
        const mergeCandidates = Object.entries(this.instanceTracker)
            .filter(([_, data]) => data.count > this.optimizationConfig.mergeThreshold)
            .map(([modelId, data]) => ({modelId, count: data.count}))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        if (mergeCandidates.length > 0) {
            console.log("Modèles candidats pour la fusion:");
            mergeCandidates.forEach(({modelId, count}) => {
                console.log(`- ${modelId}: ${count} instances`);
            });

            if (mergeCandidates[0].count > this.optimizationConfig.mergeThreshold * 2) {
                suggestions.push(`Fusionner les instances de ${mergeCandidates[0].modelId} pour réduire les draw calls`);
            }
        }

        // Analyser l'utilisation des matériaux similaires
        const totalMaterialsCount = Object.values(this.instanceTracker)
            .reduce((sum, tracker) => sum + tracker.count, 0);

        const mergeRatio = this.stats.materialsMerged / Math.max(1, totalMaterialsCount);

        if (mergeRatio < 0.3 && totalMaterialsCount > 20) {
            suggestions.push("Utiliser mergeSimilarMaterials() pour réduire les doublons de matériaux");
        }

        // Analyse des propriétés des matériaux
        const materialProperties = Object.entries(this.materialProperties);
        if (materialProperties.length > 0) {
            console.log("\nAnalyse des propriétés des matériaux:");

            // Vérifier les propriétés extrêmes
            const extremeRoughness = materialProperties.filter(([_, props]) =>
                props.roughness < 0.2 || props.roughness > 0.9);
            if (extremeRoughness.length > 0) {
                console.log("Matériaux avec roughness extrême:");
                extremeRoughness.forEach(([id, props]) => {
                    console.log(`- ${id}: roughness=${props.roughness}`);
                });
            }

            const highMetalness = materialProperties.filter(([_, props]) =>
                props.metalness > 0.5);
            if (highMetalness.length > 0) {
                console.log("Matériaux très métalliques:");
                highMetalness.forEach(([id, props]) => {
                    console.log(`- ${id}: metalness=${props.metalness}`);
                });
            }

            const highEnvMap = materialProperties.filter(([_, props]) =>
                props.envMapIntensity > 0.8);
            if (highEnvMap.length > 0) {
                console.log("Matériaux très réfléchissants:");
                highEnvMap.forEach(([id, props]) => {
                    console.log(`- ${id}: envMapIntensity=${props.envMapIntensity}`);
                });

                suggestions.push("Réduire l'intensité de l'environnement pour les matériaux très réfléchissants en cas de problèmes de performance");
            }
        }

        console.log("\nSuggestions d'optimisation:");
        if (suggestions.length > 0) {
            suggestions.forEach((suggestion, index) => {
                console.log(`${index + 1}. ${suggestion}`);
            });
        } else {
            console.log("Aucune optimisation majeure nécessaire pour le moment");
        }

        console.log("===================================");

        return {
            stats: {
                materialCount,
                textureCount,
                avgTexturesPerMaterial,
                memoryUsage: this.stats.memoryUsage,
                materialsMerged: this.stats.materialsMerged,
                instancesMerged: this.stats.instancesMerged
            },
            mergeCandidates,
            suggestions
        };
    }

    /**
     * Vérifier et optimiser les instances basées sur la distance
     */
    checkAndOptimizeInstances(modelId) {
        const instances = this.instanceTracker[modelId];
        if (!instances || instances.count < this.optimizationConfig.mergeThreshold) return;

        console.log(`Vérification d'optimisation pour ${modelId} (${instances.count} instances)`);

        // Marquer le moment de la vérification
        instances.lastMergeCheck = Date.now();
        this.stats.lastOptimization = Date.now();

        // Si beaucoup d'instances, suggérer la fusion géométrique pour réduire les draw calls
        if (instances.count > this.optimizationConfig.mergeThreshold * 3) {
            console.log(`Nombre élevé d'instances de ${modelId}: ${instances.count}. Envisager l'utilisation de mergeModelInstances() pour une fusion géométrique.`);
        }
    }

    /**
     * Ajuster le LOD global en fonction des performances
     */
    updateGlobalLOD(performanceStats = null) {
        // Si des stats de performance sont fournies, les utiliser pour ajuster automatiquement
        if (performanceStats) {
            const {fps, memoryUsage} = performanceStats;

            // Ajuster le LOD en fonction du FPS
            if (fps < 30 && this.currentLOD !== 'low') {
                console.log(`Performance basse (${fps} FPS), passage au LOD faible`);
                this.setGlobalLOD('low');
                return;
            } else if (fps < 45 && this.currentLOD === 'high') {
                console.log(`Performance moyenne (${fps} FPS), passage au LOD moyen`);
                this.setGlobalLOD('medium');
                return;
            } else if (fps > 55 && this.currentLOD === 'low') {
                console.log(`Performance améliorée (${fps} FPS), passage au LOD moyen`);
                this.setGlobalLOD('medium');
                return;
            } else if (fps > 58 && this.currentLOD === 'medium' && memoryUsage < this.optimizationConfig.memoryBudget * 0.8) {
                console.log(`Bonne performance (${fps} FPS), passage au LOD élevé`);
                this.setGlobalLOD('high');
                return;
            }
        }

        // Ajustement par défaut basé sur la mémoire utilisée
        const memoryUsageMB = this.stats.memoryUsage;
        const memoryBudget = this.optimizationConfig.memoryBudget;

        if (memoryUsageMB > memoryBudget * 0.9) {
            console.log(`Usage mémoire élevé (${memoryUsageMB}MB/${memoryBudget}MB), passage au LOD faible`);
            this.setGlobalLOD('low');
        } else if (memoryUsageMB < memoryBudget * 0.5 && this.currentLOD === 'low') {
            console.log(`Usage mémoire revenu à la normale, passage au LOD moyen`);
            this.setGlobalLOD('medium');
        }
    }

    /**
     * Définir le LOD global et mettre à jour tous les matériaux
     */
    setGlobalLOD(lodLevel) {
        if (!this.textureResolutions[lodLevel]) {
            console.error(`Niveau de LOD inconnu: ${lodLevel}`);
            return;
        }

        // Éviter les mises à jour inutiles
        if (this.currentLOD === lodLevel) return;

        const oldLOD = this.currentLOD;
        this.currentLOD = lodLevel;

        console.log(`Changement de LOD global: ${oldLOD} -> ${lodLevel}`);

        // Mettre à jour tous les matériaux actifs
        // Note: ceci est coûteux, donc on ne le fait que lorsque nécessaire
        this.refreshMaterialsWithCurrentLOD();
    }

    /**
     * Rafraîchir tous les matériaux avec le LOD actuel
     */
    refreshMaterialsWithCurrentLOD() {
        // Cette opération peut être coûteuse, donc on la limite aux cas nécessaires
        console.log(`Rafraîchissement des matériaux avec LOD: ${this.currentLOD}`);

        // Pour chaque matériau dans le pool, vérifier s'il doit être mis à jour
        Object.entries(this.materialPool).forEach(([key, material]) => {
            if (!material || !material.userData) return;

            // Extraire l'ID du modèle et les options actuelles
            const [modelId, optionsStr] = key.split('_');
            if (!modelId) return;

            let options = {};
            try {
                if (optionsStr) options = JSON.parse(optionsStr);
            } catch (e) {
                console.warn(`Impossible de parser les options pour ${key}`);
                return;
            }

            // Si le LOD actuel est différent de celui du matériau, mettre à jour
            if (options.lod !== this.currentLOD) {
                // Créer de nouvelles options avec le LOD actuel
                const newOptions = {...options, lod: this.currentLOD};

                // Précharger les textures avec le nouveau LOD
                this.preloadTexturesForModel(modelId)
                    .then(textures => {
                        if (textures) {
                            // Récupérer les propriétés personnalisées
                            const materialProps = this.getMaterialProperties(modelId);

                            // Appliquer les textures au matériau existant avec les propriétés
                            this._applyTexturesToMaterial(material, textures, {
                                ...newOptions,
                                ...materialProps,
                                modelId: modelId
                            });

                            console.log(`Matériau ${modelId} mis à jour avec LOD ${this.currentLOD}`);
                        }
                    })
                    .catch(error => {
                        console.error(`Erreur lors de la mise à jour du matériau ${modelId}:`, error);
                    });
            }
        });
    }

    /**
     * Fusion de modèles similaires pour optimiser le rendu
     * Cette méthode avancée permet de fusionner des instances proches pour réduire les draw calls
     */
    mergeModelInstances(modelId, options = {}) {
        const instances = this.instanceTracker[modelId];
        if (!instances || instances.count < 2) return null;

        // Configuration par défaut
        const config = {
            maxDistance: this.optimizationConfig.instanceMergeDistance,
            maxMergedInstances: 10,  // Nombre maximum d'instances à fusionner ensemble
            preserveOriginals: false, // Conserver les originaux après fusion
            ...options
        };

        console.log(`Tentative de fusion de ${instances.count} instances de ${modelId}`);

        // Collecter toutes les instances visibles et suffisamment proches
        const scene = window.scene || null;
        if (!scene) {
            console.warn("Impossible de fusionner sans accès à la scène");
            return null;
        }

        // Trouver toutes les instances dans la scène
        const instanceObjects = [];
        scene.traverse((node) => {
            if (node.name?.includes(modelId) && node.visible) {
                instanceObjects.push(node);
            }
        });

        if (instanceObjects.length < 2) {
            console.log(`Pas assez d'instances visibles de ${modelId} pour fusion`);
            return null;
        }

        // Regrouper les instances par proximité
        const groups = this.groupInstancesByDistance(instanceObjects, config.maxDistance);

        // Fusionner chaque groupe
        const mergedGroups = [];
        for (const group of groups) {
            if (group.length >= 2 && group.length <= config.maxMergedInstances) {
                const mergedModel = this.createMergedModel(group, modelId);
                if (mergedModel) {
                    // Ajouter à la scène
                    scene.add(mergedModel);
                    mergedGroups.push(mergedModel);

                    // Supprimer les originaux si nécessaire
                    if (!config.preserveOriginals) {
                        group.forEach(obj => {
                            scene.remove(obj);
                            obj.traverse(node => {
                                if (node.geometry) node.geometry.dispose();
                                if (node.material) {
                                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                                    materials.forEach(mat => {
                                        if (!this.materialPool[mat.uuid]) { // Ne pas disposer des matériaux partagés
                                            mat.dispose();
                                        }
                                    });
                                }
                            });
                        });
                    }
                }
            }
        }

        console.log(`${mergedGroups.length} groupes de ${modelId} fusionnés avec succès`);
        return mergedGroups;
    }

    /**
     * Regrouper les instances par distance
     */
    groupInstancesByDistance(objects, maxDistance) {
        const groups = [];
        const processed = new Set();

        for (const obj of objects) {
            if (processed.has(obj.uuid)) continue;

            const group = [obj];
            processed.add(obj.uuid);

            for (const other of objects) {
                if (other !== obj && !processed.has(other.uuid) &&
                    obj.position.distanceTo(other.position) <= maxDistance) {
                    group.push(other);
                    processed.add(other.uuid);
                }
            }

            if (group.length > 1) {
                groups.push(group);
            }
        }

        return groups;
    }



    /**
     * @deprecated Utiliser setupGroundWithDepthBasedTexturing à la place
     * Cette méthode est conservée pour compatibilité mais redirige vers la nouvelle approche
     */
    async setupGroundWithPathsMask(groundObject, maskImagePath = '/textures/ground/path_mask.png') {
        console.warn("setupGroundWithPathsMask est dépréciée, redirection vers setupGroundWithDepthBasedTexturing");

        // Rediriger vers la nouvelle méthode basée sur la profondeur
        return this.setupGroundWithDepthBasedTexturing(groundObject, {
            depthThreshold: 0.15,
            transitionZone: 0.05,
            roadValue: 0.9,
            grassValue: 0.0,
            // Utiliser des chemins forcés pour garantir la même apparence qu'avec l'image masque
            forcedPaths: [
                {
                    points: [
                        [-9, 13],      // Panneau de départ
                        [-5, 5],
                        [0, -5],
                        [2, -12],      // Premier tronc
                        [-2, -25],
                        [-5, -40],
                        [-6.9, -55.5], // Zone des feuilles/empreintes
                        [-15, -65],
                        [-25, -75],
                        [-30.5, -77],  // Zone des rochers de rivière
                        [-35, -90],
                        [-38, -105],
                        [-41, -115.5], // Zone du tronc fin
                        [-20, -120],
                        [10, -125],
                        [35, -128],
                        [52, -130]     // Vison
                    ],
                    width: 2.5
                },
                // Chemins secondaires
                {
                    points: [[-6.9, -55.5], [-10, -60], [-15, -62]],
                    width: 1.2
                },
                {
                    points: [[-30.5, -77], [-28, -78], [-31, -80], [-33, -77]],
                    width: 1.5
                }
            ]
        });
    }

    /**
     * Applique les textures au terrain uniquement en fonction de la hauteur des vertices
     * @param {Object} groundObject - L'objet 3D du terrain
     * @param {Object} options - Options de configuration
     * @returns {Boolean} - true si la configuration a réussi
     */
    setupGroundBasedOnHeight(groundObject, options = {}) {
        if (!groundObject) {
            console.error("setupGroundBasedOnHeight: objet terrain manquant");
            return false;
        }

        console.log("Configuration du terrain basée uniquement sur la hauteur des vertices");

        // Initialiser les textures si nécessaire
        this.initializeGroundTextures();

        // Options par défaut
        const config = {
            heightThreshold: options.heightThreshold || 0.1,     // Seuil relatif (0-1) pour la hauteur
            transitionZone: options.transitionZone || 0.05,      // Zone de transition entre route et herbe
            roadValue: options.roadValue || 0.9,                 // Valeur pour les routes (0-1)
            grassValue: options.grassValue || 0.0,               // Valeur pour l'herbe (0-1)
            invertHeight: options.invertHeight || false,         // Si true, les parties hautes sont des routes
            yOffset: options.yOffset || 0                        // Ajuster si le terrain n'est pas centré à Y=0
        };

        // Créer le matériau de terrain
        const material = this.createGroundMaterial();

        // Trouver les limites de hauteur du terrain pour calibrage
        let minHeight = Infinity;
        let maxHeight = -Infinity;

        groundObject.traverse((node) => {
            if (node.isMesh && node.geometry && node.geometry.attributes.position) {
                const positions = node.geometry.attributes.position;
                const count = positions.count;

                for (let i = 0; i < count; i++) {
                    const y = positions.getY(i) + config.yOffset;
                    minHeight = Math.min(minHeight, y);
                    maxHeight = Math.max(maxHeight, y);
                }
            }
        });

        console.log(`Analyse du terrain - Hauteur min: ${minHeight.toFixed(3)}, Hauteur max: ${maxHeight.toFixed(3)}`);

        // Calculer un seuil absolu à partir du seuil relatif
        const heightRange = maxHeight - minHeight;
        const effectiveThreshold = minHeight + (config.heightThreshold * heightRange);

        console.log(`Seuil de hauteur effectif: ${effectiveThreshold.toFixed(3)}`);

        // Appliquer les vertex colors basés sur la hauteur
        let appliedCount = 0;
        groundObject.traverse((node) => {
            if (node.isMesh) {
                // S'assurer que les vertex colors existent
                this.ensureVertexColors(node);

                if (node.geometry && node.geometry.attributes.position) {
                    const positions = node.geometry.attributes.position;
                    const colors = node.geometry.attributes.color;
                    const count = positions.count;

                    // Pour chaque vertex
                    for (let i = 0; i < count; i++) {
                        const y = positions.getY(i) + config.yOffset;

                        // Déterminer si c'est une route ou de l'herbe basé uniquement sur la hauteur
                        let roadFactor = 0;

                        if (config.invertHeight) {
                            // Si inversé: les parties hautes sont des routes
                            if (y > effectiveThreshold) {
                                roadFactor = config.roadValue;
                            } else if (y > effectiveThreshold - config.transitionZone) {
                                // Zone de transition
                                const t = (y - (effectiveThreshold - config.transitionZone)) / config.transitionZone;
                                roadFactor = config.grassValue + t * (config.roadValue - config.grassValue);
                            } else {
                                roadFactor = config.grassValue;
                            }
                        } else {
                            // Comportement par défaut: les parties basses sont des routes
                            if (y < effectiveThreshold) {
                                roadFactor = config.roadValue;
                            } else if (y < effectiveThreshold + config.transitionZone) {
                                // Zone de transition
                                const t = 1.0 - ((y - effectiveThreshold) / config.transitionZone);
                                roadFactor = config.grassValue + t * (config.roadValue - config.grassValue);
                            } else {
                                roadFactor = config.grassValue;
                            }
                        }

                        // Mettre à jour la couleur du vertex (canal R pour le mélange route/herbe)
                        // Préserver les canaux G et B existants
                        colors.setXYZ(i, roadFactor, colors.getY(i), colors.getZ(i));
                    }

                    // Marquer les couleurs comme modifiées
                    colors.needsUpdate = true;
                }

                // Appliquer le matériau
                node.material = material;
                appliedCount++;
            }
        });

        console.log(`Textures basées sur la hauteur appliquées à ${appliedCount} mesh(es)`);
        return true;
    }
    /**
     * Créer un modèle fusionné à partir d'un groupe d'instances
     */
    createMergedModel(instances, modelId) {
        if (!instances || instances.length === 0) return null;

        const mergedGroup = new Group();
        mergedGroup.name = `Merged_${modelId}_${instances.length}`;

        // Déterminer une position centrale pour le groupe
        const center = new Vector3();
        instances.forEach(obj => center.add(obj.position));
        center.divideScalar(instances.length);

        mergedGroup.position.copy(center);

        // Pour chaque mesh dans chaque instance, les combiner
        const meshes = {};

        instances.forEach(instance => {
            // Position relative au centre du groupe
            const relativePosition = instance.position.clone().sub(center);

            instance.traverse(node => {
                if (node.isMesh) {
                    const materialId = node.material.uuid;

                    // Créer une entrée pour ce type de matériau s'il n'existe pas
                    if (!meshes[materialId]) {
                        meshes[materialId] = {
                            material: node.material,
                            geometries: []
                        };
                    }

                    // Cloner la géométrie et appliquer la transformation
                    const clonedGeometry = node.geometry.clone();
                    const matrix = new Matrix4();

                    // Calculer la matrice de transformation incluant la position relative
                    matrix.makeTranslation(relativePosition.x, relativePosition.y, relativePosition.z);

                    // Appliquer les rotations et l'échelle si elles existent
                    if (instance.rotation) {
                        const rotMatrix = new Matrix4();
                        rotMatrix.makeRotationFromEuler(instance.rotation);
                        matrix.multiply(rotMatrix);
                    }

                    if (instance.scale) {
                        const scaleMatrix = new Matrix4();
                        scaleMatrix.makeScale(instance.scale.x, instance.scale.y, instance.scale.z);
                        matrix.multiply(scaleMatrix);
                    }

                    // Appliquer la transformation à la géométrie
                    clonedGeometry.applyMatrix4(matrix);

                    // Ajouter à la liste des géométries pour ce matériau
                    meshes[materialId].geometries.push(clonedGeometry);
                }
            });
        });

        // Créer un mesh combiné pour chaque type de matériau
        Object.values(meshes).forEach(({material, geometries}) => {
            if (geometries.length === 0) return;

            // Fusionner toutes les géométries
            const mergedGeometry = this.mergeBufferGeometries(geometries, false);

            // Obtenir un matériau optimisé
            const mergedMaterial = this.getMaterial(modelId, {
                useGroupMaterial: true,
                lod: this.determineLODForObject(instances[0])
            });

            // Créer le mesh
            const mergedMesh = new Mesh(mergedGeometry, mergedMaterial);
            mergedMesh.name = `MergedMesh_${modelId}`;
            mergedMesh.castShadow = true;
            mergedMesh.receiveShadow = true;

            // Ajouter au groupe
            mergedGroup.add(mergedMesh);

            // Disposer des géométries individuelles
            geometries.forEach(geo => geo.dispose());
        });

        // Mise à jour des statistiques
        this.stats.instancesMerged += instances.length;

        return mergedGroup;
    }

    /**
     * Utilitaire pour fusionner des géométries
     * (remplacement de la fonction THREE.BufferGeometryUtils.mergeBufferGeometries)
     */
    mergeBufferGeometries(geometries, useGroups = true) {
        // Implémentation personnalisée pour éviter la dépendance à BufferGeometryUtils
        // Basée sur le code de Three.js

        if (!geometries || geometries.length < 1) return null;

        const isIndexed = geometries[0].index !== null;
        const attributesUsed = new Set(Object.keys(geometries[0].attributes));
        const attributes = {};
        const mergedGeometry = new BufferGeometry();

        let offset = 0;

        for (let i = 0; i < geometries.length; ++i) {
            const geometry = geometries[i];

            // Vérifier si toutes les géométries sont du même type
            if (isIndexed !== (geometry.index !== null)) {
                console.error('Toutes les géométries doivent avoir le même type d\'indexation');
                return null;
            }

            // Vérifier les attributs communs
            for (const name of attributesUsed) {
                if (!geometry.attributes[name]) {
                    console.error('Toutes les géométries doivent avoir les mêmes attributs');
                    return null;
                }
            }

            // Utiliser des groupes si nécessaire
            if (useGroups) {
                let count;

                if (isIndexed) {
                    count = geometry.index.count;
                } else {
                    count = geometry.attributes.position.count;
                }

                mergedGeometry.addGroup(offset, count, i);
                offset += count;
            }

            // Fusionner les attributs
            for (const name of attributesUsed) {
                if (attributes[name] === undefined) {
                    attributes[name] = [];
                }

                attributes[name].push(geometry.attributes[name]);
            }

            // Fusionner les indices
            if (isIndexed) {
                if (attributes.index === undefined) {
                    attributes.index = [];
                }

                attributes.index.push(geometry.index);
            }
        }

        // Construire la géométrie fusionnée
        for (const name of attributesUsed) {
            const mergedAttribute = this.mergeBufferAttributes(attributes[name]);

            if (!mergedAttribute) {
                console.error('Impossible de fusionner les attributs');
                return null;
            }

            mergedGeometry.setAttribute(name, mergedAttribute);
        }

        // Fusionner les indices si nécessaire
        if (isIndexed) {
            let indexOffset = 0;
            const mergedIndex = [];

            for (let i = 0; i < geometries.length; ++i) {
                const index = attributes.index[i];

                for (let j = 0; j < index.count; ++j) {
                    mergedIndex.push(index.getX(j) + indexOffset);
                }

                indexOffset += attributes[Object.keys(attributes)[0]][i].count;
            }

            mergedGeometry.setIndex(mergedIndex);
        }

        return mergedGeometry;
    }

    /**
     * Utilitaire pour fusionner des attributs de géométrie
     */
    mergeBufferAttributes(attributes) {
        let arrayLength = 0;
        let itemSize = attributes[0].itemSize;

        for (let i = 0; i < attributes.length; i++) {
            arrayLength += attributes[i].array.length;

            if (attributes[i].itemSize !== itemSize) {
                console.error('Les attributs ont des tailles d\'éléments différentes');
                return null;
            }
        }

        const array = new attributes[0].array.constructor(arrayLength);
        let offset = 0;

        for (let i = 0; i < attributes.length; i++) {
            array.set(attributes[i].array, offset);
            offset += attributes[i].array.length;
        }

        return new BufferAttribute(array, itemSize);
    }

    // Extraire l'ID de base d'un modèle pour trouver des textures alternatives
    extractBaseModelId(modelId) {
        // Liste des préfixes et suffixes courants dans le projet
        const prefixes = ['Obstacle', 'Interactive'];
        const suffixes = ['Interactive', 'Instance'];

        let baseId = modelId;

        // Supprimer les préfixes communs
        for (const prefix of prefixes) {
            if (baseId.startsWith(prefix)) {
                baseId = baseId.substring(prefix.length);
            } else if (baseId.includes(prefix)) {
                // Gérer les préfixes en milieu de nom (comme "ObstacleTree")
                const regex = new RegExp(`${prefix}(\\w+)`, 'i');
                const match = baseId.match(regex);
                if (match && match[1]) {
                    baseId = match[1];
                }
            }
        }

        // Supprimer les suffixes communs
        for (const suffix of suffixes) {
            if (baseId.endsWith(suffix)) {
                baseId = baseId.substring(0, baseId.length - suffix.length);
            }
        }

        // Mappings spécifiques pour certains modèles
        const specialMappings = {
            'ObstacleTree': 'TrunkLarge',
            'Obstacle2Tree': 'TrunkThin'
        };

        if (specialMappings[modelId]) {
            return specialMappings[modelId];
        }

        // Si le résultat est différent de l'original et existe dans notre gestionnaire de textures
        if (baseId !== modelId && this.hasTextures(baseId)) {
            return baseId;
        }

        return null;
    }

    /**
     * Fonction spéciale pour fusionner les matériaux similaires d'un modèle existant
     */
    mergeSimilarMaterials(modelObject) {
        if (!modelObject) return 0;

        // Map pour stocker les matériaux uniques
        const uniqueMaterials = new Map();
        let replacedCount = 0;

        // Parcourir le modèle et identifier les matériaux similaires
        modelObject.traverse((node) => {
            if (!node.isMesh || !node.material) return;

            const materials = Array.isArray(node.material) ? node.material : [node.material];

            // Pour chaque matériau du mesh
            for (let i = 0; i < materials.length; i++) {
                const material = materials[i];

                // Ne pas traiter les matériaux spéciaux ou null
                if (!material || material.userData?.isSpecial) continue;

                // Générer une signature pour ce matériau
                const signature = this._getMaterialSignature(material);

                // Si on a déjà un matériau similaire, l'utiliser
                if (uniqueMaterials.has(signature)) {
                    if (Array.isArray(node.material)) {
                        // Remplacer le matériau dans le tableau
                        node.material[i] = uniqueMaterials.get(signature);
                        replacedCount++;
                    } else {
                        // Remplacer le matériau directement
                        node.material = uniqueMaterials.get(signature);
                        replacedCount++;
                    }
                } else {
                    // Sinon, ajouter ce matériau à la map
                    uniqueMaterials.set(signature, material);
                }
            }
        });

        // Mettre à jour les statistiques
        this.stats.materialsMerged += replacedCount;

        console.log(`Fusion de matériaux: ${replacedCount} matériaux remplacés, ${uniqueMaterials.size} matériaux uniques conservés`);
        return replacedCount;
    }

    // Générer la liste des assets textures pour l'AssetManager
    generateTextureAssetList() {
        const assetSet = new Set(); // Pour éviter les doublons
        const assets = [];

        // Parcourir toutes les textures de tous les modèles
        for (const [modelId, modelTextures] of Object.entries(this.texturePaths)) {
            for (const [textureType, texturePath] of Object.entries(modelTextures)) {
                // Éviter les doublons en vérifiant si le chemin est déjà dans l'ensemble
                if (!assetSet.has(texturePath)) {
                    assetSet.add(texturePath);

                    assets.push({
                        name: `${modelId}_${textureType}`,
                        type: 'texture',
                        path: texturePath,
                        license: 'CC-BY',
                        author: 'Author',
                        url: ''
                    });
                }
            }
        }

        return assets;
    }

    /**
     * Préchargement intelligent des textures
     * Précharge uniquement les textures les plus utilisées ou susceptibles d'être utilisées
     */
    async intelligentPreload(priorityModels = [], options = {}) {
        const config = {
            maxConcurrent: 5,        // Nombre maximum de chargements simultanés
            timeoutPerTexture: 5000, // Timeout en ms par texture
            preloadAllLODs: false,   // Précharger tous les LODs
            ...options
        };

        console.log("Démarrage du préchargement intelligent des textures...");

        // Liste des modèles à précharger
        const modelsToPreload = [
            ...priorityModels,
            ...Object.keys(this.texturePaths)
                .filter(id => !priorityModels.includes(id))
                .sort((a, b) => {
                    // Prioriser les modèles les plus fréquemment utilisés
                    const countA = this.instanceTracker[a]?.count || 0;
                    const countB = this.instanceTracker[b]?.count || 0;
                    return countB - countA;
                })
        ];

        // Précharger par lots pour éviter de surcharger le système
        const totalTextures = modelsToPreload.length;
        let loadedCount = 0;

        // Niveaux de LOD à précharger
        const lodsToLoad = config.preloadAllLODs
            ? ['high', 'medium', 'low']
            : [this.currentLOD];

        for (let i = 0; i < modelsToPreload.length; i += config.maxConcurrent) {
            const batch = modelsToPreload.slice(i, i + config.maxConcurrent);

            // Préchargement par lot
            const batchPromises = batch.flatMap(modelId => {
                return lodsToLoad.map(lod => {
                    // Créer une promesse avec timeout pour chaque modèle et LOD
                    return Promise.race([
                        this.preloadTexturesForModel(modelId).then(() => {
                            loadedCount++;
                            if (loadedCount % 10 === 0 || loadedCount === totalTextures) {
                                console.log(`Progrès: ${loadedCount}/${totalTextures} textures préchargées`);
                            }
                        }),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error(`Timeout lors du chargement de ${modelId}`)),
                                config.timeoutPerTexture)
                        )
                    ]).catch(err => {
                        console.warn(`Échec lors du préchargement de ${modelId}:`, err);
                    });
                });
            });

            // Attendre que ce lot soit terminé avant de passer au suivant
            await Promise.allSettled(batchPromises);
        }

        console.log(`Préchargement terminé: ${loadedCount}/${totalTextures} textures chargées avec succès`);
        return loadedCount;
    }

    // Nettoyer les ressources
    dispose() {
        console.log("Nettoyage des ressources du TextureManager...");

        // Nettoyer toutes les textures chargées
        for (const texturePath in this.loadedTextures) {
            if (this.loadedTextures[texturePath]) {
                this.loadedTextures[texturePath].dispose();
            }
        }
        this.loadedTextures = {};

        // Nettoyer tous les matériaux du pool
        for (const key in this.materialPool) {
            if (this.materialPool[key]) {
                this.materialPool[key].dispose();
            }
        }
        this.materialPool = {};

        // Réinitialiser les statistiques et le suivi des instances
        this.instanceTracker = {};
        this.stats = {
            texturesLoaded: 0,
            materialsCreated: 0,
            materialsMerged: 0,
            instancesMerged: 0,
            memoryUsage: 0,
            lastOptimization: null
        };

        console.log("Ressources du TextureManager nettoyées");
    }

    /**
     * Mettre à jour plusieurs propriétés de matériaux en même temps pour une liste de modèles
     * @param {Object} materialUpdates - Objet avec les IDs de modèles comme clés et les propriétés à mettre à jour comme valeurs
     * @returns {Object} - Résultat des mises à jour avec le nombre de matériaux mis à jour par modèle
     */
    batchUpdateMaterialProperties(materialUpdates) {
        if (!materialUpdates || typeof materialUpdates !== 'object') {
            console.error("batchUpdateMaterialProperties: l'argument doit être un objet");
            return {};
        }

        const results = {};

        Object.entries(materialUpdates).forEach(([modelId, properties]) => {
            results[modelId] = this.updateMaterialProperties(modelId, properties);
        });

        console.log(`Mise à jour par lot terminée pour ${Object.keys(materialUpdates).length} modèles`);
        return results;
    }

    /**
     * Réinitialiser les propriétés d'un matériau aux valeurs par défaut
     * @param {string} modelId - Identifiant du modèle
     * @returns {boolean} - true si la réinitialisation a réussi
     */
    resetMaterialProperties(modelId) {
        // Supprimer les propriétés personnalisées
        if (this.materialProperties[modelId]) {
            delete this.materialProperties[modelId];
        }

        // Appliquer les propriétés par défaut
        return this.updateMaterialProperties(modelId, this.defaultMaterialProperties);
    }

    /**
     * Crée un nouveau preset de matériau qui peut être appliqué à différents modèles
     * @param {string} presetName - Nom du preset
     * @param {Object} properties - Propriétés du matériau pour ce preset
     */
    createMaterialPreset(presetName, properties) {
        if (!this.materialPresets) {
            this.materialPresets = {};
        }

        this.materialPresets[presetName] = {
            ...this.defaultMaterialProperties,
            ...properties
        };

        console.log(`Preset de matériau '${presetName}' créé avec propriétés:`, properties);
        return this.materialPresets[presetName];
    }

    /**
     * Applique un preset existant à un modèle
     * @param {string} modelId - Identifiant du modèle
     * @param {string} presetName - Nom du preset à appliquer
     */
    applyMaterialPreset(modelId, presetName) {
        if (!this.materialPresets || !this.materialPresets[presetName]) {
            console.error(`Le preset '${presetName}' n'existe pas`);
            return false;
        }

        return this.updateMaterialProperties(modelId, this.materialPresets[presetName]);
    }

    /**
     * Liste tous les presets disponibles
     * @returns {Object} - Les presets disponibles
     */
    getMaterialPresets() {
        if (!this.materialPresets) {
            this.materialPresets = {};
        }

        return this.materialPresets;
    }
}

// Export d'une instance singleton
export const textureManager = new TextureManager();
export default textureManager;