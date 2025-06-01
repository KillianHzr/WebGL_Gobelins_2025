import {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import * as THREE from 'three';
import {textureManager} from '../Config/TextureManager'; // Importer textureManager
import {sceneObjectManager} from '../Config/SceneObjectManager'; // NOUVEAU: Importer sceneObjectManager

// Activer ou désactiver les logs pour le débogage
const DEBUG_MATERIALS = false;


export default function MaterialControls() {
    const {scene, gl} = useThree();
    const {debug, gui, updateDebugConfig} = useStore();
    const foldersRef = useRef({});
    const initialized = useRef(false);
    const originalMaterialStates = useRef({});
    const originalMeshStates = useRef({});  // Pour stocker l'état original des meshes
    const [materialsReady, setMaterialsReady] = useState(false);
    const materialToModelMap = useRef(new Map()); // Pour stocker la relation entre matériaux et modèles
    const fileInputRef = useRef(null); // Référence pour l'input file
    const currentTextureTargetRef = useRef(null); // Pour stocker la cible de l'upload en cours

    // Options pour les propriétés avec valeurs discrètes
    const sideOptions = {
        'Front': THREE.FrontSide,
        'Back': THREE.BackSide,
        'Double': THREE.DoubleSide
    };

    const blendingOptions = {
        'Normal': THREE.NormalBlending,
        'Additive': THREE.AdditiveBlending,
        'Subtractive': THREE.SubtractiveBlending,
        'Multiply': THREE.MultiplyBlending,
        'Custom': THREE.CustomBlending
    };

    const depthPackingOptions = {
        'None': THREE.NoDepthPacking,
        'Basic': THREE.BasicDepthPacking,
        'RGBA': THREE.RGBADepthPacking
    };

    const stencilFuncOptions = {
        'Never': THREE.NeverStencilFunc,
        'Less': THREE.LessStencilFunc,
        'Equal': THREE.EqualStencilFunc,
        'LessEqual': THREE.LessEqualStencilFunc,
        'Greater': THREE.GreaterStencilFunc,
        'NotEqual': THREE.NotEqualStencilFunc,
        'GreaterEqual': THREE.GreaterEqualStencilFunc,
        'Always': THREE.AlwaysStencilFunc
    };

    const stencilOpOptions = {
        'Zero': THREE.ZeroStencilOp,
        'Keep': THREE.KeepStencilOp,
        'Replace': THREE.ReplaceStencilOp,
        'Increment': THREE.IncrementStencilOp,
        'Decrement': THREE.DecrementStencilOp,
        'IncrementWrap': THREE.IncrementWrapStencilOp,
        'DecrementWrap': THREE.DecrementWrapStencilOp,
        'Invert': THREE.InvertStencilOp
    };

    // NOUVELLE FONCTION: Trouver l'ObjectKey correspondant dans SceneObjectManager
    const findObjectKeyFromSceneManager = (objectName) => {
        if (!objectName || !sceneObjectManager) return null;

        // Liste des objets à ignorer (objets génériques de scène)
        const ignoreList = [
            'defaultMaterial',
            'Plane',
            'Plane001',
            'Plane002',
            'Plane003',
            'Retopo_Plane',
            'Retopo_Plane001',
            'Retopo_Plane002',
            'Node0',
            'Node1',
            'Node2',
            'Cylindre',
            'Loft',
            'Loft001',
            'Loft007',
            'POTEAU',
            'Paper',
            'Trunk', // Objet générique, pas celui du TextureManager
            'Sphere',
            'Cube',
            'Camera',
            'Light',
            'Sun',
            'Armature'
        ];

        // Vérifier si l'objet doit être ignoré
        const shouldIgnore = ignoreList.some(ignore =>
            objectName === ignore ||
            objectName.startsWith(ignore + '.') ||
            objectName.startsWith(ignore + '_')
        );

        if (shouldIgnore) {
            return null; // Pas de warning pour les objets ignorés
        }

        // 1. Recherche exacte dans le catalogue
        const catalog = sceneObjectManager.objectCatalog;
        if (catalog[objectName]) {
            return objectName;
        }

        // 2. Recherche par inclusion (l'objectName contient l'ObjectKey)
        for (const [objectKey, config] of Object.entries(catalog)) {
            if (objectName.includes(objectKey)) {
                return objectKey;
            }
        }

        // 3. Recherche par inclusion inverse (l'ObjectKey contient l'objectName)
        for (const [objectKey, config] of Object.entries(catalog)) {
            if (objectKey.includes(objectName)) {
                return objectKey;
            }
        }

        // 4. Recherche par correspondance avec l'ID du modèle de texture
        for (const [objectKey, config] of Object.entries(catalog)) {
            if (config.id && (config.id === objectName || objectName.includes(config.id))) {
                return objectKey;
            }
        }

        // 5. Patterns de correspondance pour les objets avec suffixes/préfixes
        const cleanName = objectName
            .replace(/Instance/g, '')
            .replace(/Interactive/g, '')
            .replace(/Obstacle/g, '')
            .replace(/_lod\d+.*/, '')
            .replace(/\d+$/, '');

        for (const [objectKey, config] of Object.entries(catalog)) {
            const cleanObjectKey = objectKey
                .replace(/Instance/g, '')
                .replace(/Interactive/g, '')
                .replace(/Obstacle/g, '');

            if (cleanName === cleanObjectKey || cleanName.includes(cleanObjectKey) || cleanObjectKey.includes(cleanName)) {
                return objectKey;
            }
        }

        // Seulement log en mode debug et pour les objets non ignorés
        if (DEBUG_MATERIALS) {
            console.log(`No ObjectKey found for object: ${objectName}`);
        }
        return null;
    };

    // NOUVELLE FONCTION: Obtenir le Model ID pour les textures à partir de l'ObjectKey
    const getTextureModelIdFromObjectKey = (objectKey) => {
        if (!objectKey || !sceneObjectManager) return null;

        const objectConfig = sceneObjectManager.getObjectFromCatalog(objectKey);
        if (objectConfig && objectConfig.id) {
            // Vérifier si ce model ID existe dans textureManager
            if (textureManager && textureManager.hasTextures(objectConfig.id)) {
                return objectConfig.id;
            }
        }

        // Fallback: chercher dans textureManager avec l'objectKey directement
        if (textureManager && textureManager.hasTextures(objectKey)) {
            return objectKey;
        }

        return null;
    };

    // Fonction utilitaire pour extraire le model ID à partir du nom de l'objet de manière plus robuste
    const extractModelId = (objectName) => {
        if (!objectName) return null;

        // NOUVELLE APPROCHE: Utiliser d'abord SceneObjectManager
        const objectKey = findObjectKeyFromSceneManager(objectName);
        if (objectKey) {
            return objectKey;
        }

        // Fallback: ancien système de patterns
        const patterns = [
            /^(.+?)_lod\d+/, // Format standard e.g. "TrunkThin_lod0_chunk..."
            /^(.+?)(?=\d+$)/, // Suffixe numérique e.g. "TrunkThin123"
            /^(.+?)Instance/, // Pattern d'instance e.g. "TrunkThinInstance"
            /^(.+?)Interactive/, // Pattern interactif e.g. "TrunkThinInteractive"
        ];

        for (const pattern of patterns) {
            const match = objectName.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        // Si aucun pattern ne correspond, on utilise le nom complet
        return objectName;
    };

    // Fonction pour trouver le bon modèle ID dans le TextureManager
    const findModelIdInTextureManager = (objectName) => {
        if (!objectName) return null;

        // NOUVELLE APPROCHE: Utiliser SceneObjectManager
        const objectKey = findObjectKeyFromSceneManager(objectName);
        if (objectKey) {
            const textureModelId = getTextureModelIdFromObjectKey(objectKey);
            if (textureModelId) {
                return textureModelId;
            }
        }

        // Fallback: ancienne méthode
        const baseId = extractModelId(objectName);

        // Vérifier si ce modelId existe directement dans textureManager
        if (textureManager && textureManager.hasTextures(baseId)) {
            return baseId;
        }

        // Recherche plus poussée dans les IDs connus de textureManager
        if (textureManager && textureManager.texturePaths) {
            const knownIds = Object.keys(textureManager.texturePaths);

            // Recherche exacte
            const exactMatch = knownIds.find(id => id === baseId);
            if (exactMatch) return exactMatch;

            // Recherche par inclusion
            const includedMatch = knownIds.find(id =>
                objectName.includes(id) || id.includes(baseId)
            );
            if (includedMatch) return includedMatch;

            // Recherche par similarité (première partie du nom)
            for (const id of knownIds) {
                if (id.startsWith(baseId) || baseId.startsWith(id)) {
                    return id;
                }
            }
        }

        return baseId; // Retourner l'ID de base comme fallback
    };

    // NOUVELLE FONCTION: Obtenir le nom d'affichage pour l'interface
    const getDisplayName = (objectName) => {
        // Priorité 1: ObjectKey du SceneObjectManager
        const objectKey = findObjectKeyFromSceneManager(objectName);
        if (objectKey) {
            return objectKey;
        }

        // Priorité 2: Model ID du TextureManager
        const textureModelId = findModelIdInTextureManager(objectName);
        if (textureModelId && textureModelId !== objectName) {
            return textureModelId;
        }

        // Priorité 3: Nom nettoyé de l'objet original
        if (objectName) {
            // Nettoyer les noms d'objets génériques pour qu'ils soient plus lisibles
            const cleanedName = objectName
                .replace(/^defaultMaterial/, 'Default Material')
                .replace(/^Plane(\d*)$/, 'Plane$1')
                .replace(/^Retopo_/, 'Retopo ')
                .replace(/^Node(\d*)$/, 'Node$1')
                .replace(/^Loft(\d*)$/, 'Loft$1');

            return cleanedName;
        }

        // Fallback
        return 'Unknown';
    };

    // Fonction pour collecter tous les matériaux et meshes de la scène
    const collectAllMaterials = () => {
        const materials = new Map();
        const meshes = new Map();  // Stocker les références aux meshes
        const modelHierarchy = new Map(); // Stocker les relations parent-enfant

        // Première passe : construire la hiérarchie des objets
        scene.traverse((object) => {
            if (object.parent && object.parent !== scene) {
                if (!modelHierarchy.has(object.parent.uuid)) {
                    modelHierarchy.set(object.parent.uuid, []);
                }
                modelHierarchy.get(object.parent.uuid).push(object.uuid);
            }
        });

        scene.traverse((object) => {
            if (!object.isMesh || !object.material) return;

            // Sauvegarder l'état original du mesh pour les propriétés de shadow
            if (!originalMeshStates.current[object.uuid]) {
                originalMeshStates.current[object.uuid] = {
                    castShadow: object.castShadow,
                    receiveShadow: object.receiveShadow,
                    renderOrder: object.renderOrder,
                    visible: object.visible,
                    frustumCulled: object.frustumCulled
                };
            }

            // Ajouter le mesh à la map
            if (!meshes.has(object.uuid)) {
                meshes.set(object.uuid, object);
            }

            const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];

            meshMaterials.forEach(material => {
                // MODIFICATION PRINCIPALE: Utiliser getDisplayName pour obtenir l'ObjectKey
                const displayName = getDisplayName(object.name);
                const textureModelId = findModelIdInTextureManager(object.name);

                if (material && material.uuid && !materials.has(material.uuid)) {
                    // Enregistrer le mapping matériau -> textureModelId (pour TextureManager)
                    if (textureModelId) {
                        materialToModelMap.current.set(material.uuid, textureModelId);
                    }

                    // Sauvegarder l'état original de manière exhaustive
                    if (!originalMaterialStates.current[material.uuid]) {
                        const originalState = {
                            // Propriétés de base
                            wireframe: material.wireframe,
                            transparent: material.transparent,
                            opacity: material.opacity,
                            side: material.side,
                            depthWrite: material.depthWrite,
                            depthTest: material.depthTest,
                            alphaTest: material.alphaTest,
                            blending: material.blending,
                            vertexColors: material.vertexColors,
                            visible: material.visible,
                            toneMapped: material.toneMapped,
                            dithering: material.dithering,
                            flatShading: material.flatShading,
                            fog: material.fog,

                            // PBR Properties
                            roughness: material.roughness,
                            metalness: material.metalness,

                            // Stencil properties
                            stencilWrite: material.stencilWrite,
                            stencilWriteMask: material.stencilWriteMask,
                            stencilRef: material.stencilRef,
                            stencilFunc: material.stencilFunc,
                            stencilFail: material.stencilFail,
                            stencilZFail: material.stencilZFail,
                            stencilZPass: material.stencilZPass,

                            // Mapping intensities
                            envMapIntensity: material.envMapIntensity,
                            aoMapIntensity: material.aoMapIntensity,
                            normalMapType: material.normalMapType,
                            displacementScale: material.displacementScale,
                            displacementBias: material.displacementBias,

                            // MeshPhysicalMaterial
                            clearcoat: material.clearcoat,
                            clearcoatRoughness: material.clearcoatRoughness,
                            reflectivity: material.reflectivity,
                            ior: material.ior,
                            sheen: material.sheen,
                            sheenRoughness: material.sheenRoughness,
                            transmission: material.transmission,
                            thickness: material.thickness,
                            attenuationDistance: material.attenuationDistance,
                            anisotropy: material.anisotropy,
                            anisotropyRotation: material.anisotropyRotation,
                            iridescence: material.iridescence,
                            iridescenceIOR: material.iridescenceIOR,
                            iridescenceThicknessRange: material.iridescenceThicknessRange?.slice(),

                            // MeshPhongMaterial
                            shininess: material.shininess,
                            specularMapIntensity: material.specularMapIntensity,
                            combine: material.combine,

                            // MeshLambertMaterial / MeshToonMaterial / etc.
                            emissiveIntensity: material.emissiveIntensity,
                            lightMapIntensity: material.lightMapIntensity,
                            bumpScale: material.bumpScale,
                            refractionRatio: material.refractionRatio,

                            // LineBasicMaterial, PointsMaterial
                            size: material.size,
                            sizeAttenuation: material.sizeAttenuation,
                            linewidth: material.linewidth,
                            linecap: material.linecap,
                            linejoin: material.linejoin,

                            // Colors and vector values cloned to avoid reference issues
                            color: material.color ? material.color.clone() : undefined,
                            emissive: material.emissive ? material.emissive.clone() : undefined,
                            specular: material.specular ? material.specular.clone() : undefined,
                            sheenColor: material.sheenColor ? material.sheenColor.clone() : undefined,
                            attenuationColor: material.attenuationColor ? material.attenuationColor.clone() : undefined,
                            normalScale: material.normalScale ? new THREE.Vector2(material.normalScale.x, material.normalScale.y) : undefined
                        };

                        // Store texture references and their settings
                        originalState.textures = {};
                        const textureProps = [
                            'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap',
                            'displacementMap', 'envMap', 'lightMap', 'alphaMap', 'bumpMap', 'clearcoatMap',
                            'clearcoatNormalMap', 'clearcoatRoughnessMap', 'transmissionMap', 'thicknessMap',
                            'sheenColorMap', 'sheenRoughnessMap', 'specularMap', 'specularIntensityMap',
                            'iridescenceMap', 'iridescenceThicknessMap', 'anisotropyMap', 'matcap'
                        ];

                        textureProps.forEach(prop => {
                            if (material[prop]) {
                                originalState.textures[prop] = {
                                    uuid: material[prop].uuid,
                                    repeat: material[prop].repeat ? material[prop].repeat.clone() : undefined,
                                    offset: material[prop].offset ? material[prop].offset.clone() : undefined,
                                    center: material[prop].center ? material[prop].center.clone() : undefined,
                                    rotation: material[prop].rotation,
                                    wrapS: material[prop].wrapS,
                                    wrapT: material[prop].wrapT,
                                    encoding: material[prop].encoding,
                                    flipY: material[prop].flipY,
                                    premultiplyAlpha: material[prop].premultiplyAlpha,
                                    format: material[prop].format,
                                    minFilter: material[prop].minFilter,
                                    magFilter: material[prop].magFilter,
                                    anisotropy: material[prop].anisotropy
                                };
                            }
                        });

                        originalMaterialStates.current[material.uuid] = originalState;
                    }

                    // MODIFICATION: Utiliser displayName au lieu de modelId extrait
                    material._objectName = displayName || 'Unknown';
                    material._objectType = object.type;
                    material._objectUuid = object.uuid; // Stocker l'UUID de l'objet
                    material._textureModelId = textureModelId; // Stocker séparément l'ID pour TextureManager

                    // Stocker la hiérarchie parent-enfant
                    material._parentUuid = object.parent ? object.parent.uuid : null;
                    material._childrenUuids = modelHierarchy.get(object.uuid) || [];

                    // Associer le matériau avec le mesh
                    material._meshRefs = material._meshRefs || [];
                    if (!material._meshRefs.includes(object.uuid)) {
                        material._meshRefs.push(object.uuid);
                    }

                    materials.set(material.uuid, material);
                }
            });
        });

        // debugLog(`Collected ${materials.size} unique materials and ${meshes.size} meshes from scene`);
        return {
            materials: Array.from(materials.values()),
            meshes
        };
    };

    // Fonction pour vérifier si la scène est prête
    const isSceneReady = () => {
        let materialCount = 0;

        scene.traverse((object) => {
            if (object.isMesh && object.material) {
                materialCount++;
            }
        });

        return materialCount > 0;
    };

    // Fonction pour réinitialiser un matériau à son état d'origine
    const resetMaterial = (material) => {
        if (!material || !material.uuid) return;

        const originalState = originalMaterialStates.current[material.uuid];
        if (!originalState) return;

        try {
            // Restaurer toutes les propriétés scalaires
            Object.entries(originalState).forEach(([key, value]) => {
                // Ignorer les propriétés spéciales (couleurs, vecteurs, textures)
                if (key === 'color' || key === 'emissive' || key === 'specular' ||
                    key === 'sheenColor' || key === 'attenuationColor' ||
                    key === 'normalScale' || key === 'textures') {
                    return;
                }

                // Restaurer la propriété si elle existe
                if (material[key] !== undefined) {
                    material[key] = value;
                }
            });

            // Restaurer les couleurs
            if (originalState.color && material.color) material.color.copy(originalState.color);
            if (originalState.emissive && material.emissive) material.emissive.copy(originalState.emissive);
            if (originalState.specular && material.specular) material.specular.copy(originalState.specular);
            if (originalState.sheenColor && material.sheenColor) material.sheenColor.copy(originalState.sheenColor);
            if (originalState.attenuationColor && material.attenuationColor) material.attenuationColor.copy(originalState.attenuationColor);

            // Restaurer les vecteurs
            if (originalState.normalScale && material.normalScale) {
                material.normalScale.x = originalState.normalScale.x;
                material.normalScale.y = originalState.normalScale.y;
            }

            // Restaurer les paramètres des textures
            if (originalState.textures) {
                Object.entries(originalState.textures).forEach(([textureName, textureState]) => {
                    const texture = material[textureName];
                    if (!texture) return;

                    if (textureState.repeat && texture.repeat) texture.repeat.copy(textureState.repeat);
                    if (textureState.offset && texture.offset) texture.offset.copy(textureState.offset);
                    if (textureState.center && texture.center) texture.center.copy(textureState.center);
                    if (textureState.rotation !== undefined) texture.rotation = textureState.rotation;
                    if (textureState.wrapS !== undefined) texture.wrapS = textureState.wrapS;
                    if (textureState.wrapT !== undefined) texture.wrapT = textureState.wrapT;
                    if (textureState.encoding !== undefined) texture.encoding = textureState.encoding;
                    if (textureState.flipY !== undefined) texture.flipY = textureState.flipY;
                    if (textureState.premultiplyAlpha !== undefined) texture.premultiplyAlpha = textureState.premultiplyAlpha;
                    if (textureState.minFilter !== undefined) texture.minFilter = textureState.minFilter;
                    if (textureState.magFilter !== undefined) texture.magFilter = textureState.magFilter;
                    if (textureState.anisotropy !== undefined) texture.anisotropy = textureState.anisotropy;

                    texture.needsUpdate = true;
                });
            }

            material.needsUpdate = true;

            // Réinitialiser dans TextureManager si un modelId est associé
            const textureModelId = material._textureModelId || materialToModelMap.current.get(material.uuid);
            if (textureModelId && textureManager) {
                textureManager.resetMaterialProperties(textureModelId);
            }
        } catch (error) {
            console.warn(`Error resetting material ${material._objectName}:`, error);
        }
    };

    // Fonction pour réinitialiser les propriétés de shadow d'un mesh
    const resetMeshShadowProperties = (meshUuid, meshesMap) => {
        const mesh = meshesMap.get(meshUuid);
        if (!mesh) return;

        const originalState = originalMeshStates.current[meshUuid];
        if (!originalState) return;

        try {
            if (originalState.castShadow !== undefined) mesh.castShadow = originalState.castShadow;
            if (originalState.receiveShadow !== undefined) mesh.receiveShadow = originalState.receiveShadow;
            if (originalState.renderOrder !== undefined) mesh.renderOrder = originalState.renderOrder;
            if (originalState.visible !== undefined) mesh.visible = originalState.visible;
            if (originalState.frustumCulled !== undefined) mesh.frustumCulled = originalState.frustumCulled;
        } catch (error) {
            console.warn(`Error resetting mesh properties for ${mesh.name}:`, error);
        }
    };

    // Fonction pour propager les propriétés PBR aux enfants
    const propagatePropertiesToChildren = (material, properties, meshesMap) => {
        if (!material || !material._childrenUuids || material._childrenUuids.length === 0) {
            return;
        }

        const childMeshes = material._childrenUuids
            .map(uuid => meshesMap.get(uuid))
            .filter(mesh => mesh && mesh.material);

        // debugLog(`Propagating properties to ${childMeshes.length} children of ${material._objectName}`);

        childMeshes.forEach(childMesh => {
            const childMaterial = childMesh.material;
            if (!childMaterial) return;

            // Appliquer les propriétés au matériau de l'enfant
            Object.entries(properties).forEach(([prop, value]) => {
                if (childMaterial[prop] !== undefined) {
                    childMaterial[prop] = value;
                }
            });

            childMaterial.needsUpdate = true;

            // Mettre à jour dans TextureManager si nécessaire
            const childTextureModelId = childMaterial._textureModelId || materialToModelMap.current.get(childMaterial.uuid);
            if (childTextureModelId && textureManager) {
                textureManager.updateMaterialProperties(childTextureModelId, properties);
            }

            // Propager récursivement aux enfants des enfants
            propagatePropertiesToChildren(childMaterial, properties, meshesMap);
        });
    };

    // Fonction pour appliquer les propriétés du TextureManager à un matériau
    const applyTextureManagerPropertiesToMaterial = (material, textureModelId) => {
        if (!material || !textureModelId || !textureManager) return;

        try {
            // Récupérer les propriétés depuis TextureManager
            const tmProps = textureManager.getMaterialProperties(textureModelId);
            if (!tmProps) return;

            // debugLog(`Applying TextureManager properties to ${textureModelId}:`, tmProps);

            // Appliquer les propriétés au matériau
            if (tmProps.roughness !== undefined && material.roughness !== undefined)
                material.roughness = tmProps.roughness;

            if (tmProps.metalness !== undefined && material.metalness !== undefined)
                material.metalness = tmProps.metalness;

            if (tmProps.envMapIntensity !== undefined && material.envMapIntensity !== undefined)
                material.envMapIntensity = tmProps.envMapIntensity;

            if (tmProps.aoIntensity !== undefined && material.aoMapIntensity !== undefined)
                material.aoMapIntensity = tmProps.aoIntensity;

            if (tmProps.normalScale !== undefined && material.normalScale) {
                material.normalScale.x = tmProps.normalScale;
                material.normalScale.y = tmProps.normalScale;
            }

            if (tmProps.displacementScale !== undefined && material.displacementScale !== undefined)
                material.displacementScale = tmProps.displacementScale;

            material.needsUpdate = true;
        } catch (error) {
            console.warn(`Error applying TextureManager properties to ${textureModelId}:`, error);
        }
    };

    // Fonction pour appliquer les propriétés du TextureManager à tous les matériaux
    const applyTextureManagerPropertiesToAllMaterials = () => {
        if (!textureManager) return;

        if (DEBUG_MATERIALS) {
            console.log("Applying TextureManager properties to all materials...");
        }

        let appliedCount = 0;

        scene.traverse((object) => {
            if (!object.isMesh || !object.material) return;

            const materials = Array.isArray(object.material) ? object.material : [object.material];

            materials.forEach(material => {
                // Utiliser findModelIdInTextureManager pour obtenir l'ID de texture approprié
                const textureModelId = findModelIdInTextureManager(object.name);
                if (textureModelId) {
                    applyTextureManagerPropertiesToMaterial(material, textureModelId);

                    // Mémoriser l'association matériau-modèle pour une utilisation ultérieure
                    if (!materialToModelMap.current.has(material.uuid)) {
                        materialToModelMap.current.set(material.uuid, textureModelId);
                    }

                    // Stocker l'ID de texture dans le matériau
                    material._textureModelId = textureModelId;
                    appliedCount++;
                }
            });
        });

        if (DEBUG_MATERIALS && appliedCount > 0) {
            console.log(`Applied TextureManager properties to ${appliedCount} materials`);
        }
    };

    // Fonction pour gérer le remplacement d'une texture par une image uploadée
    const handleTextureUpload = (event, material, textureName) => {
        const file = event.target.files[0];
        if (!file) return;

        // Récupérer l'ancienne texture pour copier ses paramètres
        const oldTexture = material[textureName];
        if (!oldTexture) {
            console.warn(`No texture found for ${textureName} in material ${material._objectName}`);
            return;
        }

        // Créer une URL pour l'image
        const imageUrl = URL.createObjectURL(file);

        // Créer une nouvelle texture
        const loader = new THREE.TextureLoader();
        loader.load(
            imageUrl,
            (newTexture) => {
                // Copier les paramètres de l'ancienne texture
                if (oldTexture.repeat) newTexture.repeat.copy(oldTexture.repeat);
                if (oldTexture.offset) newTexture.offset.copy(oldTexture.offset);
                if (oldTexture.center) newTexture.center.copy(oldTexture.center);
                newTexture.rotation = oldTexture.rotation;
                newTexture.wrapS = oldTexture.wrapS;
                newTexture.wrapT = oldTexture.wrapT;
                newTexture.encoding = oldTexture.encoding;
                newTexture.flipY = oldTexture.flipY;
                newTexture.premultiplyAlpha = oldTexture.premultiplyAlpha;
                newTexture.format = oldTexture.format;
                newTexture.type = oldTexture.type;
                newTexture.minFilter = oldTexture.minFilter;
                newTexture.magFilter = oldTexture.magFilter;
                newTexture.anisotropy = oldTexture.anisotropy;

                // Appliquer la nouvelle texture au matériau
                material[textureName] = newTexture;

                // Marquer la texture et le matériau comme nécessitant une mise à jour
                newTexture.needsUpdate = true;
                material.needsUpdate = true;

                console.log(`Successfully replaced ${textureName} with uploaded image for ${material._objectName}`);

                // Libérer l'URL
                URL.revokeObjectURL(imageUrl);

                // Forcer le rendu pour voir les changements
                if (gl && gl.render && scene) {
                    const camera = scene.getObjectByProperty('isCamera', true) ||
                        scene.children.find(child => child.isCamera);
                    if (camera) gl.render(scene, camera);
                }
            },
            undefined,
            (error) => {
                console.error(`Error loading texture: ${error.message}`);
                URL.revokeObjectURL(imageUrl);
            }
        );
    };

    // Créer un input file caché pour l'upload
    // Créer un input file caché pour l'upload
    const createHiddenFileInput = () => {
        // Supprimer l'ancien input s'il existe et s'il est bien dans le DOM
        if (fileInputRef.current) {
            // Vérifier si l'élément est effectivement un enfant de document.body
            if (document.body && document.body.contains(fileInputRef.current)) {
                try {
                    document.body.removeChild(fileInputRef.current);
                } catch (error) {
                    console.warn("Erreur lors de la suppression de l'input file:", error);
                }
            }
            // Réinitialiser la référence
            fileInputRef.current = null;
        }

        // Créer un nouvel input file
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';

        // Vérifier que document.body existe avant d'ajouter l'élément
        if (document.body) {
            document.body.appendChild(input);
        } else {
            console.error("document.body n'est pas disponible pour ajouter l'input file");
            return;
        }

        // Ajouter un écouteur pour gérer la sélection de fichier
        input.addEventListener('change', (event) => {
            if (currentTextureTargetRef.current) {
                const {material, textureName} = currentTextureTargetRef.current;
                handleTextureUpload(event, material, textureName);
                currentTextureTargetRef.current = null;
            }
        });

        fileInputRef.current = input;
    };

    // Fonction pour déclencher l'upload d'une texture
    const triggerTextureUpload = (material, textureName) => {
        if (!fileInputRef.current) {
            createHiddenFileInput();
        }

        // Stocker la cible actuelle de l'upload
        currentTextureTargetRef.current = {material, textureName};

        // Déclencher le dialogue de sélection de fichier
        fileInputRef.current.click();
    };

    // Observer les changements dans le mode debug
    useEffect(() => {
        if (debug?.active && materialsReady) {
            // Appliquer les propriétés du TextureManager chaque fois que le debug est activé
            applyTextureManagerPropertiesToAllMaterials();
        }
    }, [debug?.active, materialsReady]);

    // Hook pour vérifier la disponibilité des matériaux
    useEffect(() => {
        const checkMaterialsReadyInterval = setInterval(() => {
            if (isSceneReady()) {
                clearInterval(checkMaterialsReadyInterval);
                setMaterialsReady(true);

                // Appliquer les propriétés du TextureManager dès que les matériaux sont prêts
                if (debug?.active) {
                    applyTextureManagerPropertiesToAllMaterials();
                }
            }
        }, 500); // Vérifier toutes les 500ms

        return () => clearInterval(checkMaterialsReadyInterval);
    }, [scene, debug]);

    // Créer l'input file caché au chargement du composant
    useEffect(() => {
        createHiddenFileInput();

        // Nettoyage lors du démontage
        return () => {
            if (fileInputRef.current) {
                document.body.removeChild(fileInputRef.current);
            }
        };
    }, []);

    // Initialisation des contrôles GUI pour les matériaux
    useEffect(() => {
        // Vérifier si le debug est activé et l'interface GUI disponible
        // Et si les matériaux sont prêts
        if (!materialsReady ||
            !debug?.active ||
            !debug?.showGui ||
            !gui ||
            typeof gui.addFolder !== 'function' ||
            initialized.current
        ) {
            return;
        }

        // Appliquer les propriétés du TextureManager à tous les matériaux dès que le debug est activé
        applyTextureManagerPropertiesToAllMaterials();

        // Utiliser un timeout supplémentaire pour s'assurer que tout est chargé
        const initTimer = setTimeout(() => {
            try {
                console.log("Setting up material controls with SceneObjectManager integration");

                // Collecter tous les matériaux et meshes
                const {materials: allMaterials, meshes: meshesMap} = collectAllMaterials();
                if (allMaterials.length === 0) {
                    console.warn("No materials found in scene");
                    return;
                }

                // Créer le dossier principal pour les matériaux
                let materialsFolder;
                try {
                    if (gui.__folders && gui.__folders["Materials"]) {
                        gui.removeFolder(gui.__folders["Materials"]);
                    }
                    materialsFolder = gui.addFolder("Materials");
                    materialsFolder.close();
                } catch (e) {
                    console.warn("Error creating Materials folder:", e);
                    try {
                        materialsFolder = gui.addFolder("MaterialsControls");
                    } catch (e2) {
                        console.error("Failed to create folder:", e2);
                        return;
                    }
                }

                // Ajouter un dossier pour TextureManager global
                const texManagerFolder = materialsFolder.addFolder("TextureManager Global");

                // Contrôles globaux pour TextureManager
                if (textureManager) {
                    const texManagerControls = {
                        logMaterialProperties: () => {
                            textureManager.logMaterialProperties();
                        },
                        logTextureStats: () => {
                            textureManager.logTextureStats();
                        },
                        analyzePerfAndSuggestOptimizations: () => {
                            textureManager.analyzePerfAndSuggestOptimizations();
                        },
                        setGlobalLOD: 'high'
                    };

                    // LOD global
                    texManagerFolder.add(texManagerControls, 'setGlobalLOD', ['high', 'medium', 'low'])
                        .name('Global LOD Level')
                        .onChange(value => {
                            textureManager.setGlobalLOD(value);
                            textureManager.refreshMaterialsWithCurrentLOD();
                        });

                    // Boutons utilitaires
                    texManagerFolder.add(texManagerControls, 'logMaterialProperties').name('Log Material Properties');
                    texManagerFolder.add(texManagerControls, 'logTextureStats').name('Log Texture Stats');
                    texManagerFolder.add(texManagerControls, 'analyzePerfAndSuggestOptimizations').name('Analyze & Optimize');
                }

                texManagerFolder.close();

                // Ajouter des dossiers communs pour les opérations globales
                const globalSettingsFolder = materialsFolder.addFolder("Global Settings");
                const globalMaterialControls = {
                    wireframe: false,
                    flatShading: false,
                    transparent: false,
                    opacity: 1.0,
                    side: THREE.FrontSide,
                    envMapIntensity: 1.0,
                    roughness: 0.5,
                    metalness: 0.0,

                    // Actions globales
                    applyToAllMaterials: () => {
                        allMaterials.forEach(material => {
                            if (material.wireframe !== undefined) material.wireframe = globalMaterialControls.wireframe;
                            if (material.flatShading !== undefined) material.flatShading = globalMaterialControls.flatShading;
                            if (material.transparent !== undefined) material.transparent = globalMaterialControls.transparent;
                            if (material.opacity !== undefined) material.opacity = globalMaterialControls.opacity;
                            if (material.side !== undefined) material.side = globalMaterialControls.side;
                            if (material.envMapIntensity !== undefined) material.envMapIntensity = globalMaterialControls.envMapIntensity;
                            if (material.roughness !== undefined) material.roughness = globalMaterialControls.roughness;
                            if (material.metalness !== undefined) material.metalness = globalMaterialControls.metalness;
                            material.needsUpdate = true;

                            // Mise à jour dans TextureManager
                            const textureModelId = material._textureModelId || materialToModelMap.current.get(material.uuid);
                            if (textureModelId && textureManager) {
                                textureManager.updateMaterialProperties(textureModelId, {
                                    roughness: globalMaterialControls.roughness,
                                    metalness: globalMaterialControls.metalness,
                                    envMapIntensity: globalMaterialControls.envMapIntensity
                                });
                            }
                        });
                    },

                    resetAllMaterials: () => {
                        allMaterials.forEach(material => {
                            resetMaterial(material);
                        });
                    }
                };

                // Ajouter les contrôles globaux
                globalSettingsFolder.add(globalMaterialControls, 'wireframe').name('Global Wireframe');
                globalSettingsFolder.add(globalMaterialControls, 'flatShading').name('Global Flat Shading');
                globalSettingsFolder.add(globalMaterialControls, 'transparent').name('Global Transparency');
                globalSettingsFolder.add(globalMaterialControls, 'opacity', 0, 1, 0.01).name('Global Opacity');
                globalSettingsFolder.add(globalMaterialControls, 'side', sideOptions).name('Global Side');
                globalSettingsFolder.add(globalMaterialControls, 'envMapIntensity', 0, 5, 0.1).name('Global EnvMap Intensity');
                globalSettingsFolder.add(globalMaterialControls, 'roughness', 0, 1, 0.01).name('Global Roughness');
                globalSettingsFolder.add(globalMaterialControls, 'metalness', 0, 1, 0.01).name('Global Metalness');

                // Boutons d'action
                globalSettingsFolder.add(globalMaterialControls, 'applyToAllMaterials').name('Apply To All Materials');
                globalSettingsFolder.add(globalMaterialControls, 'resetAllMaterials').name('Reset All Materials');

                globalSettingsFolder.close();

                // Créer un sous-dossier pour chaque matériau unique
                allMaterials.forEach((material) => {
                    // MODIFICATION PRINCIPALE: Utiliser _objectName qui contient maintenant l'ObjectKey
                    const folderName = material._objectName || 'Unknown Material';

                    // Ne pas créer de dossiers pour les objets génériques non reconnus
                    const shouldSkipFolder = folderName === "Unknown Material" ||
                        folderName === "Unknown" ||
                        folderName.startsWith("Plane") ||
                        folderName.startsWith("Retopo") ||
                        folderName.startsWith("Node") ||
                        folderName.startsWith("Default Material") ||
                        folderName === "POTEAU" ||
                        folderName === "Paper" ||
                        folderName.startsWith("Loft") ||
                        folderName === "Cylindre";

                    if (shouldSkipFolder) {
                        if (DEBUG_MATERIALS) {
                            console.log(`Skipping folder creation for generic object: ${folderName}`);
                        }
                        return; // Skip ce matériau
                    }

                    const materialFolder = materialsFolder.addFolder(folderName);
                    foldersRef.current[material.uuid] = materialFolder;
                    materialFolder.close();

                    // Récupérer les propriétés depuis TextureManager si disponible
                    const textureModelId = material._textureModelId || materialToModelMap.current.get(material.uuid);
                    let textureManagerProps = {};

                    if (textureManager && textureModelId) {
                        try {
                            textureManagerProps = textureManager.getMaterialProperties(textureModelId) || {};
                            // debugLog(`Found TextureManager properties for ${textureModelId}:`, textureManagerProps);
                        } catch (error) {
                            console.warn(`Error getting properties from TextureManager for ${textureModelId}:`, error);
                        }
                    }

                    // État du matériau - inclure toutes les propriétés possibles
                    const materialControls = {
                        // Propriétés de base
                        wireframe: material.wireframe || false,
                        transparent: material.transparent || false,
                        opacity: material.opacity !== undefined ? material.opacity : 1.0,
                        side: material.side !== undefined ? material.side : THREE.FrontSide,
                        depthWrite: material.depthWrite !== undefined ? material.depthWrite : true,
                        depthTest: material.depthTest !== undefined ? material.depthTest : true,
                        alphaTest: material.alphaTest !== undefined ? material.alphaTest : 0.0,
                        blending: material.blending !== undefined ? material.blending : THREE.NormalBlending,
                        vertexColors: material.vertexColors || false,
                        toneMapped: material.toneMapped !== undefined ? material.toneMapped : true,
                        dithering: material.dithering || false,
                        flatShading: material.flatShading || false,
                        fog: material.fog !== undefined ? material.fog : true,

                        // PBR Properties - Priorité aux valeurs de TextureManager
                        color: material.color ? '#' + material.color.getHexString() : '#ffffff',
                        roughness: textureManagerProps.roughness !== undefined
                            ? textureManagerProps.roughness
                            : (material.roughness !== undefined ? material.roughness : 0.5),
                        metalness: textureManagerProps.metalness !== undefined
                            ? textureManagerProps.metalness
                            : (material.metalness !== undefined ? material.metalness : 0.0),
                        envMapIntensity: textureManagerProps.envMapIntensity !== undefined
                            ? textureManagerProps.envMapIntensity
                            : (material.envMapIntensity !== undefined ? material.envMapIntensity : 1.0),

                        // Ambient Occlusion
                        aoMapIntensity: textureManagerProps.aoIntensity !== undefined
                            ? textureManagerProps.aoIntensity
                            : (material.aoMapIntensity !== undefined ? material.aoMapIntensity : 1.0),

                        // Normal Mapping
                        normalScale: textureManagerProps.normalScale !== undefined
                            ? textureManagerProps.normalScale
                            : (material.normalScale ? material.normalScale.x : 1.0),

                        // Displacement
                        displacementScale: textureManagerProps.displacementScale !== undefined
                            ? textureManagerProps.displacementScale
                            : (material.displacementScale !== undefined ? material.displacementScale : 1.0),

                        // Emissive properties
                        emissive: material.emissive ? '#' + material.emissive.getHexString() : '#000000',
                        emissiveIntensity: material.emissiveIntensity !== undefined ? material.emissiveIntensity : 1.0,

                        // Mapping properties
                        bumpScale: material.bumpScale !== undefined ? material.bumpScale : 1.0,
                        displacementBias: material.displacementBias !== undefined ? material.displacementBias : 0.0,

                        // Clearcoat (MeshPhysicalMaterial)
                        clearcoat: material.clearcoat !== undefined ? material.clearcoat : 0.0,
                        clearcoatRoughness: material.clearcoatRoughness !== undefined ? material.clearcoatRoughness : 0.0,
                        reflectivity: material.reflectivity !== undefined ? material.reflectivity : 0.5,

                        // Transmission (for glass-like materials)
                        transmission: material.transmission !== undefined ? material.transmission : 0.0,
                        ior: material.ior !== undefined ? material.ior : 1.5,
                        thickness: material.thickness !== undefined ? material.thickness : 0.0,
                        attenuationColor: material.attenuationColor ? '#' + material.attenuationColor.getHexString() : '#ffffff',
                        attenuationDistance: material.attenuationDistance !== undefined ? material.attenuationDistance : 0.0,

                        // Sheen (Fabric-like materials)
                        sheen: material.sheen !== undefined ? material.sheen : 0.0,
                        sheenColor: material.sheenColor ? '#' + material.sheenColor.getHexString() : '#ffffff',
                        sheenRoughness: material.sheenRoughness !== undefined ? material.sheenRoughness : 0.0,

                        // Anisotropy (for brushed metals)
                        anisotropy: material.anisotropy !== undefined ? material.anisotropy : 0.0,
                        anisotropyRotation: material.anisotropyRotation !== undefined ? material.anisotropyRotation : 0.0,

                        // Iridescence (for surfaces like soap bubbles, butterfly wings)
                        iridescence: material.iridescence !== undefined ? material.iridescence : 0.0,
                        iridescenceIOR: material.iridescenceIOR !== undefined ? material.iridescenceIOR : 1.3,

                        // MeshPhongMaterial / MeshLambertMaterial
                        shininess: material.shininess !== undefined ? material.shininess : 30,
                        specular: material.specular ? '#' + material.specular.getHexString() : '#111111',

                        // Shadows
                        castShadow: material._meshRefs?.length > 0
                            ? meshesMap.get(material._meshRefs[0])?.castShadow || false
                            : false,
                        receiveShadow: material._meshRefs?.length > 0
                            ? meshesMap.get(material._meshRefs[0])?.receiveShadow || false
                            : false,

                        // MODIFICATION: Afficher les IDs séparément
                        objectKey: material._objectName || "Unknown",
                        textureModelId: textureModelId || "None",
                        propagateToChildren: false,

                        // Reset button action
                        reset: () => {
                            resetMaterial(material);
                            material._meshRefs?.forEach(meshUuid => resetMeshShadowProperties(meshUuid, meshesMap));

                            // Update GUI controllers
                            for (const key in materialControls) {
                                const controller = materialFolder.__controllers.find(c => c.property === key);
                                if (controller) controller.updateDisplay();
                            }

                            // Force re-render
                            if (gl && gl.render && scene) {
                                const camera = scene.getObjectByProperty('isCamera', true) ||
                                    scene.children.find(child => child.isCamera);
                                if (camera) gl.render(scene, camera);
                            }
                        }
                    };

                    // Créer des sous-dossiers pour organiser les contrôles
                    const basicFolder = materialFolder.addFolder('Basic Properties');
                    const pbrFolder = materialFolder.addFolder('PBR Properties');
                    const advancedFolder = materialFolder.addFolder('Advanced Properties');
                    const texturesFolder = materialFolder.addFolder('Textures');
                    const specialFolder = materialFolder.addFolder('Special Effects');
                    const tmFolder = materialFolder.addFolder('TextureManager');

                    // ---- BASIC PROPERTIES ----
                    // Couleur de base si disponible
                    if (material.color) {
                        basicFolder.addColor(materialControls, 'color').name('Color').onChange(value => {
                            try {
                                material.color.set(value);
                                material.needsUpdate = true;
                            } catch (error) {
                                console.warn(`Error updating color for ${material._objectName}:`, error);
                            }
                        });
                    }

                    // Wireframe, transparency, side
                    basicFolder.add(materialControls, 'wireframe').name('Wireframe').onChange(value => {
                        try {
                            material.wireframe = value;
                            material.needsUpdate = true;
                        } catch (error) {
                            console.warn(`Error updating wireframe for ${material._objectName}:`, error);
                        }
                    });

                    basicFolder.add(materialControls, 'transparent').name('Transparent').onChange(value => {
                        try {
                            material.transparent = value;
                            material.needsUpdate = true;
                        } catch (error) {
                            console.warn(`Error updating transparency for ${material._objectName}:`, error);
                        }
                    });

                    basicFolder.add(materialControls, 'opacity', 0, 1, 0.01).name('Opacity').onChange(value => {
                        try {
                            material.opacity = value;
                            material.needsUpdate = true;
                        } catch (error) {
                            console.warn(`Error updating opacity for ${material._objectName}:`, error);
                        }
                    });

                    basicFolder.add(materialControls, 'side', sideOptions).name('Side').onChange(value => {
                        try {
                            material.side = parseInt(value);
                            material.needsUpdate = true;
                        } catch (error) {
                            console.warn(`Error updating side for ${material._objectName}:`, error);
                        }
                    });

                    basicFolder.add(materialControls, 'flatShading').name('Flat Shading').onChange(value => {
                        try {
                            material.flatShading = value;
                            material.needsUpdate = true;
                        } catch (error) {
                            console.warn(`Error updating flatShading for ${material._objectName}:`, error);
                        }
                    });

                    // ---- PBR PROPERTIES ----
                    // Roughness et metalness pour les materials PBR
                    if (material.roughness !== undefined) {
                        pbrFolder.add(materialControls, 'roughness', 0, 1, 0.01).name('Roughness').onChange(value => {
                            try {
                                material.roughness = value;
                                material.needsUpdate = true;

                                // Mettre à jour dans TextureManager
                                if (textureModelId && textureManager) {
                                    textureManager.updateMaterialProperty(textureModelId, 'roughness', value);

                                    // Propager aux enfants si demandé
                                    if (materialControls.propagateToChildren) {
                                        propagatePropertiesToChildren(material, {roughness: value}, meshesMap);
                                    }
                                }
                            } catch (error) {
                                console.warn(`Error updating roughness for ${material._objectName}:`, error);
                            }
                        });
                    }

                    if (material.metalness !== undefined) {
                        pbrFolder.add(materialControls, 'metalness', 0, 1, 0.01).name('Metalness').onChange(value => {
                            try {
                                material.metalness = value;
                                material.needsUpdate = true;

                                // Mettre à jour dans TextureManager
                                if (textureModelId && textureManager) {
                                    textureManager.updateMaterialProperty(textureModelId, 'metalness', value);

                                    // Propager aux enfants si demandé
                                    if (materialControls.propagateToChildren) {
                                        propagatePropertiesToChildren(material, {metalness: value}, meshesMap);
                                    }
                                }
                            } catch (error) {
                                console.warn(`Error updating metalness for ${material._objectName}:`, error);
                            }
                        });
                    }

                    // Environment mapping
                    if (material.envMapIntensity !== undefined) {
                        pbrFolder.add(materialControls, 'envMapIntensity', 0, 5, 0.05)
                            .name('EnvMap Intensity')
                            .onChange(value => {
                                try {
                                    material.envMapIntensity = value;
                                    material.needsUpdate = true;

                                    // Mettre à jour dans TextureManager
                                    if (textureModelId && textureManager) {
                                        textureManager.updateMaterialProperty(textureModelId, 'envMapIntensity', value);

                                        // Propager aux enfants si demandé
                                        if (materialControls.propagateToChildren) {
                                            propagatePropertiesToChildren(material, {envMapIntensity: value}, meshesMap);
                                        }
                                    }

                                    // debugLog(`Updated envMapIntensity for ${material._objectName} to ${value}`);
                                } catch (error) {
                                    console.warn(`Error updating envMapIntensity for ${material._objectName}:`, error);
                                }
                            });
                    }

                    // Ambient occlusion mapping
                    if (material.aoMapIntensity !== undefined) {
                        pbrFolder.add(materialControls, 'aoMapIntensity', 0, 5, 0.05)
                            .name('AO Intensity')
                            .onChange(value => {
                                try {
                                    material.aoMapIntensity = value;
                                    material.needsUpdate = true;

                                    // Mettre à jour dans TextureManager
                                    if (textureModelId && textureManager) {
                                        textureManager.updateMaterialProperty(textureModelId, 'aoIntensity', value);

                                        // Propager aux enfants si demandé
                                        if (materialControls.propagateToChildren) {
                                            propagatePropertiesToChildren(material, {aoMapIntensity: value}, meshesMap);
                                        }
                                    }
                                } catch (error) {
                                    console.warn(`Error updating aoMapIntensity for ${material._objectName}:`, error);
                                }
                            });
                    }

                    // Emissive properties
                    if (material.emissive) {
                        pbrFolder.addColor(materialControls, 'emissive')
                            .name('Emissive Color')
                            .onChange(value => {
                                try {
                                    material.emissive.set(value);
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating emissive for ${material._objectName}:`, error);
                                }
                            });

                        if (material.emissiveIntensity !== undefined) {
                            pbrFolder.add(materialControls, 'emissiveIntensity', 0, 5, 0.05)
                                .name('Emissive Intensity')
                                .onChange(value => {
                                    try {
                                        material.emissiveIntensity = value;
                                        material.needsUpdate = true;
                                    } catch (error) {
                                        console.warn(`Error updating emissiveIntensity for ${material._objectName}:`, error);
                                    }
                                });
                        }
                    }

                    // Displacement mapping
                    if (material.displacementScale !== undefined) {
                        pbrFolder.add(materialControls, 'displacementScale', 0, 5, 0.05)
                            .name('Displ. Scale')
                            .onChange(value => {
                                try {
                                    material.displacementScale = value;
                                    material.needsUpdate = true;

                                    // Mettre à jour dans TextureManager
                                    if (textureModelId && textureManager) {
                                        textureManager.updateMaterialProperty(textureModelId, 'displacementScale', value);

                                        // Propager aux enfants si demandé
                                        if (materialControls.propagateToChildren) {
                                            propagatePropertiesToChildren(material, {displacementScale: value}, meshesMap);
                                        }
                                    }
                                } catch (error) {
                                    console.warn(`Error updating displacementScale for ${material._objectName}:`, error);
                                }
                            });
                    }

                    if (material.displacementBias !== undefined) {
                        pbrFolder.add(materialControls, 'displacementBias', -1, 1, 0.01)
                            .name('Displ. Bias')
                            .onChange(value => {
                                try {
                                    material.displacementBias = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating displacementBias for ${material._objectName}:`, error);
                                }
                            });
                    }

                    // Bump scaling
                    if (material.bumpScale !== undefined) {
                        pbrFolder.add(materialControls, 'bumpScale', 0, 5, 0.05)
                            .name('Bump Scale')
                            .onChange(value => {
                                try {
                                    material.bumpScale = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating bumpScale for ${material._objectName}:`, error);
                                }
                            });
                    }

                    // MeshPhongMaterial properties
                    if (material.shininess !== undefined) {
                        pbrFolder.add(materialControls, 'shininess', 0, 100, 1)
                            .name('Shininess')
                            .onChange(value => {
                                try {
                                    material.shininess = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating shininess for ${material._objectName}:`, error);
                                }
                            });
                    }

                    if (material.specular) {
                        pbrFolder.addColor(materialControls, 'specular')
                            .name('Specular Color')
                            .onChange(value => {
                                try {
                                    material.specular.set(value);
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating specular for ${material._objectName}:`, error);
                                }
                            });
                    }

                    // ---- ADVANCED PROPERTIES ----
                    // Depth and blending settings
                    advancedFolder.add(materialControls, 'depthWrite')
                        .name('Depth Write')
                        .onChange(value => {
                            try {
                                material.depthWrite = value;
                                material.needsUpdate = true;
                            } catch (error) {
                                console.warn(`Error updating depthWrite for ${material._objectName}:`, error);
                            }
                        });

                    advancedFolder.add(materialControls, 'depthTest')
                        .name('Depth Test')
                        .onChange(value => {
                            try {
                                material.depthTest = value;
                                material.needsUpdate = true;
                            } catch (error) {
                                console.warn(`Error updating depthTest for ${material._objectName}:`, error);
                            }
                        });

                    advancedFolder.add(materialControls, 'alphaTest', 0, 1, 0.01)
                        .name('Alpha Test')
                        .onChange(value => {
                            try {
                                material.alphaTest = value;
                                material.needsUpdate = true;
                            } catch (error) {
                                console.warn(`Error updating alphaTest for ${material._objectName}:`, error);
                            }
                        });

                    advancedFolder.add(materialControls, 'blending', blendingOptions)
                        .name('Blending Mode')
                        .onChange(value => {
                            try {
                                material.blending = parseInt(value);
                                material.needsUpdate = true;
                            } catch (error) {
                                console.warn(`Error updating blending for ${material._objectName}:`, error);
                            }
                        });

                    // Render settings
                    advancedFolder.add(materialControls, 'vertexColors')
                        .name('Vertex Colors')
                        .onChange(value => {
                            try {
                                material.vertexColors = value;
                                material.needsUpdate = true;
                            } catch (error) {
                                console.warn(`Error updating vertexColors for ${material._objectName}:`, error);
                            }
                        });

                    advancedFolder.add(materialControls, 'toneMapped')
                        .name('Tone Mapped')
                        .onChange(value => {
                            try {
                                material.toneMapped = value;
                                material.needsUpdate = true;
                            } catch (error) {
                                console.warn(`Error updating toneMapped for ${material._objectName}:`, error);
                            }
                        });

                    advancedFolder.add(materialControls, 'dithering')
                        .name('Dithering')
                        .onChange(value => {
                            try {
                                material.dithering = value;
                                material.needsUpdate = true;
                            } catch (error) {
                                console.warn(`Error updating dithering for ${material._objectName}:`, error);
                            }
                        });

                    advancedFolder.add(materialControls, 'fog')
                        .name('Affected by Fog')
                        .onChange(value => {
                            try {
                                material.fog = value;
                                material.needsUpdate = true;
                            } catch (error) {
                                console.warn(`Error updating fog for ${material._objectName}:`, error);
                            }
                        });

                    // ---- SPECIAL EFFECTS FOLDER ----
                    // MeshPhysicalMaterial - Clearcoat
                    if (material.clearcoat !== undefined) {
                        specialFolder.add(materialControls, 'clearcoat', 0, 1, 0.01)
                            .name('Clearcoat')
                            .onChange(value => {
                                try {
                                    material.clearcoat = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating clearcoat for ${material._objectName}:`, error);
                                }
                            });

                        specialFolder.add(materialControls, 'clearcoatRoughness', 0, 1, 0.01)
                            .name('Clearcoat Roughness')
                            .onChange(value => {
                                try {
                                    material.clearcoatRoughness = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating clearcoatRoughness for ${material._objectName}:`, error);
                                }
                            });
                    }

                    // MeshPhysicalMaterial - Transmission (glass-like)
                    if (material.transmission !== undefined) {
                        specialFolder.add(materialControls, 'transmission', 0, 1, 0.01)
                            .name('Transmission')
                            .onChange(value => {
                                try {
                                    material.transmission = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating transmission for ${material._objectName}:`, error);
                                }
                            });

                        specialFolder.add(materialControls, 'ior', 1, 2.33, 0.01)
                            .name('IOR')
                            .onChange(value => {
                                try {
                                    material.ior = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating ior for ${material._objectName}:`, error);
                                }
                            });

                        specialFolder.add(materialControls, 'thickness', 0, 5, 0.01)
                            .name('Thickness')
                            .onChange(value => {
                                try {
                                    material.thickness = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating thickness for ${material._objectName}:`, error);
                                }
                            });

                        if (material.attenuationDistance !== undefined) {
                            specialFolder.add(materialControls, 'attenuationDistance', 0, 1000, 1)
                                .name('Attenuation Dist.')
                                .onChange(value => {
                                    try {
                                        material.attenuationDistance = value;
                                        material.needsUpdate = true;
                                    } catch (error) {
                                        console.warn(`Error updating attenuationDistance for ${material._objectName}:`, error);
                                    }
                                });
                        }

                        if (material.attenuationColor) {
                            specialFolder.addColor(materialControls, 'attenuationColor')
                                .name('Attenuation Color')
                                .onChange(value => {
                                    try {
                                        material.attenuationColor.set(value);
                                        material.needsUpdate = true;
                                    } catch (error) {
                                        console.warn(`Error updating attenuationColor for ${material._objectName}:`, error);
                                    }
                                });
                        }
                    }

                    // MeshPhysicalMaterial - Sheen (fabric-like)
                    if (material.sheen !== undefined) {
                        specialFolder.add(materialControls, 'sheen', 0, 1, 0.01)
                            .name('Sheen')
                            .onChange(value => {
                                try {
                                    material.sheen = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating sheen for ${material._objectName}:`, error);
                                }
                            });

                        if (material.sheenColor) {
                            specialFolder.addColor(materialControls, 'sheenColor')
                                .name('Sheen Color')
                                .onChange(value => {
                                    try {
                                        material.sheenColor.set(value);
                                        material.needsUpdate = true;
                                    } catch (error) {
                                        console.warn(`Error updating sheenColor for ${material._objectName}:`, error);
                                    }
                                });
                        }

                        specialFolder.add(materialControls, 'sheenRoughness', 0, 1, 0.01)
                            .name('Sheen Roughness')
                            .onChange(value => {
                                try {
                                    material.sheenRoughness = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating sheenRoughness for ${material._objectName}:`, error);
                                }
                            });
                    }

                    // MeshPhysicalMaterial - Anisotropy (brushed metal)
                    if (material.anisotropy !== undefined) {
                        specialFolder.add(materialControls, 'anisotropy', 0, 1, 0.01)
                            .name('Anisotropy')
                            .onChange(value => {
                                try {
                                    material.anisotropy = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating anisotropy for ${material._objectName}:`, error);
                                }
                            });

                        specialFolder.add(materialControls, 'anisotropyRotation', 0, Math.PI * 2, 0.01)
                            .name('Anisotropy Rotation')
                            .onChange(value => {
                                try {
                                    material.anisotropyRotation = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating anisotropyRotation for ${material._objectName}:`, error);
                                }
                            });
                    }

                    // MeshPhysicalMaterial - Iridescence (butterfly wings, soap bubbles)
                    if (material.iridescence !== undefined) {
                        specialFolder.add(materialControls, 'iridescence', 0, 1, 0.01)
                            .name('Iridescence')
                            .onChange(value => {
                                try {
                                    material.iridescence = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating iridescence for ${material._objectName}:`, error);
                                }
                            });

                        specialFolder.add(materialControls, 'iridescenceIOR', 1, 2.33, 0.01)
                            .name('Iridescence IOR')
                            .onChange(value => {
                                try {
                                    material.iridescenceIOR = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating iridescenceIOR for ${material._objectName}:`, error);
                                }
                            });
                    }

                    // ---- TEXTURE MAPPING ----
                    // Créer une liste de toutes les propriétés de textures possibles
                    const textureProps = [
                        {name: 'map', desc: 'Base Color Map'},
                        {name: 'normalMap', desc: 'Normal Map'},
                        {name: 'roughnessMap', desc: 'Roughness Map'},
                        {name: 'metalnessMap', desc: 'Metalness Map'},
                        {name: 'aoMap', desc: 'Ambient Occlusion Map'},
                        {name: 'emissiveMap', desc: 'Emissive Map'},
                        {name: 'displacementMap', desc: 'Displacement Map'},
                        {name: 'alphaMap', desc: 'Alpha Map'},
                        {name: 'bumpMap', desc: 'Bump Map'},
                        {name: 'lightMap', desc: 'Light Map'},
                        {name: 'clearcoatMap', desc: 'Clearcoat Map'},
                        {name: 'clearcoatNormalMap', desc: 'Clearcoat Normal Map'},
                        {name: 'clearcoatRoughnessMap', desc: 'Clearcoat Rough. Map'},
                        {name: 'transmissionMap', desc: 'Transmission Map'},
                        {name: 'thicknessMap', desc: 'Thickness Map'},
                        {name: 'sheenColorMap', desc: 'Sheen Color Map'},
                        {name: 'sheenRoughnessMap', desc: 'Sheen Rough. Map'},
                        {name: 'specularMap', desc: 'Specular Map'},
                        {name: 'specularIntensityMap', desc: 'Specular Int. Map'},
                        {name: 'iridescenceMap', desc: 'Iridescence Map'},
                        {name: 'iridescenceThicknessMap', desc: 'Iridescence Thick. Map'},
                        {name: 'anisotropyMap', desc: 'Anisotropy Map'},
                        {name: 'matcap', desc: 'MatCap Map'},
                        {name: 'envMap', desc: 'Environment Map'}
                    ];

                    // Pour chaque texture présente dans le matériau, créer des contrôles
                    textureProps.forEach(({name, desc}) => {
                        if (material[name]) {
                            const texture = material[name];
                            const textureFolder = texturesFolder.addFolder(desc);

                            // Créer un contrôle pour activer/désactiver la texture
                            const textureControls = {
                                enabled: true,
                                repeatX: texture.repeat ? texture.repeat.x : 1,
                                repeatY: texture.repeat ? texture.repeat.y : 1,
                                offsetX: texture.offset ? texture.offset.x : 0,
                                offsetY: texture.offset ? texture.offset.y : 0,
                                rotation: texture.rotation || 0,
                                flipY: texture.flipY !== undefined ? texture.flipY : true,
                                // Nouvelle action pour déclencher l'upload
                                uploadTexture: () => {
                                    triggerTextureUpload(material, name);
                                }
                            };

                            // Bouton pour remplacer la texture
                            textureFolder.add(textureControls, 'uploadTexture')
                                .name('Upload New Texture');

                            // Enable/disable texture
                            textureFolder.add(textureControls, 'enabled')
                                .name('Enabled')
                                .onChange(value => {
                                    try {
                                        if (!value) {
                                            // Store current texture to re-enable later
                                            material._tempTextures = material._tempTextures || {};
                                            material._tempTextures[name] = material[name];
                                            material[name] = null;
                                        } else if (material._tempTextures && material._tempTextures[name]) {
                                            // Restore saved texture
                                            material[name] = material._tempTextures[name];
                                        }
                                        material.needsUpdate = true;
                                    } catch (error) {
                                        console.warn(`Error toggling ${name} for ${material._objectName}:`, error);
                                    }
                                });

                            // Texture repeat controls
                            if (texture.repeat) {
                                textureFolder.add(textureControls, 'repeatX', 0.1, 10, 0.1)
                                    .name('Repeat X')
                                    .onChange(value => {
                                        try {
                                            texture.repeat.x = value;
                                            texture.needsUpdate = true;
                                        } catch (error) {
                                            console.warn(`Error updating ${name} repeatX for ${material._objectName}:`, error);
                                        }
                                    });

                                textureFolder.add(textureControls, 'repeatY', 0.1, 10, 0.1)
                                    .name('Repeat Y')
                                    .onChange(value => {
                                        try {
                                            texture.repeat.y = value;
                                            texture.needsUpdate = true;
                                        } catch (error) {
                                            console.warn(`Error updating ${name} repeatY for ${material._objectName}:`, error);
                                        }
                                    });
                            }

                            // Texture offset controls
                            if (texture.offset) {
                                textureFolder.add(textureControls, 'offsetX', -1, 1, 0.01)
                                    .name('Offset X')
                                    .onChange(value => {
                                        try {
                                            texture.offset.x = value;
                                            texture.needsUpdate = true;
                                        } catch (error) {
                                            console.warn(`Error updating ${name} offsetX for ${material._objectName}:`, error);
                                        }
                                    });

                                textureFolder.add(textureControls, 'offsetY', -1, 1, 0.01)
                                    .name('Offset Y')
                                    .onChange(value => {
                                        try {
                                            texture.offset.y = value;
                                            texture.needsUpdate = true;
                                        } catch (error) {
                                            console.warn(`Error updating ${name} offsetY for ${material._objectName}:`, error);
                                        }
                                    });
                            }

                            // Texture rotation
                            textureFolder.add(textureControls, 'rotation', 0, Math.PI * 2, 0.01)
                                .name('Rotation')
                                .onChange(value => {
                                    try {
                                        texture.rotation = value;
                                        texture.needsUpdate = true;
                                    } catch (error) {
                                        console.warn(`Error updating ${name} rotation for ${material._objectName}:`, error);
                                    }
                                });

                            // Texture flip Y
                            textureFolder.add(textureControls, 'flipY')
                                .name('Flip Y')
                                .onChange(value => {
                                    try {
                                        texture.flipY = value;
                                        texture.needsUpdate = true;
                                    } catch (error) {
                                        console.warn(`Error updating ${name} flipY for ${material._objectName}:`, error);
                                    }
                                });

                            textureFolder.close(); // Fermer le dossier de texture par défaut
                        }
                    });

                    // ---- SHADOW PROPERTIES ----
                    // Ajouter les contrôleurs pour les propriétés de shadow
                    if (material._meshRefs && material._meshRefs.length > 0) {
                        const shadowFolder = materialFolder.addFolder('Shadow Properties');

                        shadowFolder.add(materialControls, 'castShadow').name('Cast Shadow').onChange(value => {
                            try {
                                // Appliquer à tous les meshes associés à ce matériau
                                material._meshRefs.forEach(meshUuid => {
                                    const mesh = meshesMap.get(meshUuid);
                                    if (mesh) {
                                        mesh.castShadow = value;
                                    }
                                });
                            } catch (error) {
                                console.warn(`Error updating cast shadow for ${material._objectName}:`, error);
                            }
                        });

                        shadowFolder.add(materialControls, 'receiveShadow').name('Receive Shadow').onChange(value => {
                            try {
                                // Appliquer à tous les meshes associés à ce matériau
                                material._meshRefs.forEach(meshUuid => {
                                    const mesh = meshesMap.get(meshUuid);
                                    if (mesh) {
                                        mesh.receiveShadow = value;
                                        if (mesh.material) {
                                            mesh.material.needsUpdate = true;
                                        }
                                    }
                                });
                            } catch (error) {
                                console.warn(`Error updating receive shadow for ${material._objectName}:`, error);
                            }
                        });

                        shadowFolder.close(); // Fermer le dossier d'ombres par défaut
                    }

                    // ---- TEXTURE MANAGER FOLDER ----
                    // MODIFICATION: Afficher objectKey et textureModelId séparément
                    tmFolder.add(materialControls, 'objectKey').name('Object Key').disable();
                    if (textureModelId) {
                        tmFolder.add(materialControls, 'textureModelId').name('Texture Model ID').disable();
                        tmFolder.add(materialControls, 'propagateToChildren').name('Propagate to Children');

                        // Bouton pour enregistrer dans TextureManager
                        const tmActions = {
                            saveToTextureManager: () => {
                                if (textureModelId && textureManager) {
                                    const properties = {
                                        roughness: material.roughness,
                                        metalness: material.metalness,
                                        envMapIntensity: material.envMapIntensity,
                                        aoIntensity: material.aoMapIntensity,
                                        normalScale: material.normalScale ? material.normalScale.x : 1.0,
                                        displacementScale: material.displacementScale
                                    };

                                    textureManager.setMaterialProperties(textureModelId, properties);
                                    // debugLog(`Saved properties to TextureManager for ${textureModelId}:`, properties);

                                    // Propager aux enfants si demandé
                                    if (materialControls.propagateToChildren) {
                                        propagatePropertiesToChildren(material, properties, meshesMap);
                                    }
                                }
                            },
                            resetInTextureManager: () => {
                                if (textureModelId && textureManager) {
                                    textureManager.resetMaterialProperties(textureModelId);
                                    // debugLog(`Reset properties in TextureManager for ${textureModelId}`);

                                    // Mettre à jour l'interface
                                    const defaultProps = textureManager.defaultMaterialProperties;

                                    // Mettre à jour les propriétés du matériau
                                    if (material.roughness !== undefined) material.roughness = defaultProps.roughness;
                                    if (material.metalness !== undefined) material.metalness = defaultProps.metalness;
                                    if (material.envMapIntensity !== undefined) material.envMapIntensity = defaultProps.envMapIntensity;
                                    if (material.aoMapIntensity !== undefined) material.aoMapIntensity = defaultProps.aoIntensity;
                                    if (material.normalScale !== undefined) {
                                        material.normalScale.x = defaultProps.normalScale;
                                        material.normalScale.y = defaultProps.normalScale;
                                    }
                                    if (material.displacementScale !== undefined) material.displacementScale = defaultProps.displacementScale;

                                    material.needsUpdate = true;

                                    // Mettre à jour les contrôleurs
                                    materialControls.roughness = defaultProps.roughness;
                                    materialControls.metalness = defaultProps.metalness;
                                    materialControls.envMapIntensity = defaultProps.envMapIntensity;
                                    materialControls.aoMapIntensity = defaultProps.aoIntensity;
                                    materialControls.normalScale = defaultProps.normalScale;
                                    materialControls.displacementScale = defaultProps.displacementScale;

                                    // Rafraîchir tous les contrôleurs
                                    for (const key in materialControls) {
                                        const controller = materialFolder.__controllers.find(c => c.property === key);
                                        if (controller) controller.updateDisplay();
                                    }

                                    // Propager aux enfants si demandé
                                    if (materialControls.propagateToChildren) {
                                        propagatePropertiesToChildren(material, defaultProps, meshesMap);
                                    }
                                }
                            }
                        };

                        // Ajouter les boutons d'action
                        tmFolder.add(tmActions, 'saveToTextureManager').name('Save to TextureManager');
                        tmFolder.add(tmActions, 'resetInTextureManager').name('Reset in TextureManager');
                    } else {
                        // Afficher un message si aucun model ID de texture n'est trouvé
                        tmFolder.add({noTextureModel: 'No Texture Model Found'}, 'noTextureModel').name('Status').disable();
                    }

                    tmFolder.close();

                    // Ajouter un bouton de réinitialisation
                    materialFolder.add(materialControls, 'reset').name('Reset Material');

                    // Fermer tous les sous-dossiers par défaut
                    basicFolder.close();
                    pbrFolder.close();
                    advancedFolder.close();
                    texturesFolder.close();
                    specialFolder.close();
                }); // Fermeture du forEach

                materialsFolder.close();
                initialized.current = true;
                console.log("Material controls initialized successfully");

                // Afficher les statistiques TextureManager seulement en mode debug
                if (DEBUG_MATERIALS && textureManager) {
                    textureManager.logTextureStats();
                }

                // Log des correspondances trouvées (seulement pour les objets reconnus)
                if (DEBUG_MATERIALS) {
                    console.log("ObjectKey mapping summary:");
                    const recognizedMaterials = allMaterials.filter(material =>
                        material._objectName &&
                        material._objectName !== 'Unknown' &&
                        !material._objectName.startsWith('Plane') &&
                        !material._objectName.startsWith('Retopo') &&
                        !material._objectName.startsWith('Node') &&
                        !material._objectName.startsWith('Default Material')
                    );

                    recognizedMaterials.forEach(material => {
                        console.log(`  ${material._objectName} -> TextureModel: ${material._textureModelId || 'None'}`);
                    });

                    console.log(`Total: ${recognizedMaterials.length} recognized materials out of ${allMaterials.length} total materials`);
                } else {
                    // Version simplifiée pour le log normal
                    const recognizedCount = allMaterials.filter(material =>
                        material._objectName &&
                        material._objectName !== 'Unknown' &&
                        !material._objectName.startsWith('Plane') &&
                        !material._objectName.startsWith('Retopo') &&
                        !material._objectName.startsWith('Node') &&
                        !material._objectName.startsWith('Default Material')
                    ).length;

                    console.log(`Material controls initialized: ${recognizedCount} recognized objects with materials`);
                }

            } catch (error) {
                console.error("Error initializing material controls:", error);
            }
        }, 10000); // Délai d'initialisation

        // Nettoyage
        return () => {
            clearTimeout(initTimer);
            if (gui) {
                try {
                    // Supprimer tous les dossiers de matériaux
                    Object.values(foldersRef.current).forEach(folder => {
                        try {
                            gui.removeFolder(folder);
                        } catch (e) {
                            console.warn("Error removing material folder:", e);
                        }
                    });
                } catch (e) {
                    console.warn("Error during cleanup:", e);
                }
            }
        };
    }, [materialsReady, debug, gui, scene, gl]);

    return null; // Ce composant ne rend rien
}