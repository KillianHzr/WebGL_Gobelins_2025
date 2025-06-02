import React, {createContext, useCallback, useContext, useEffect, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';

// Contexte pour le RayCaster
const RayCasterContext = createContext(null);

/**
 * Composant RayCaster qui gère la détection des clics et pointeurs dans la scène 3D
 * avec filtrage intelligent pour éviter les objets de performance
 */
const RayCaster = ({children}) => {
    const {raycaster, camera, gl, scene} = useThree();
    const clickListenersRef = useRef(new Map());
    const pointerEnterListenersRef = useRef(new Map());
    const pointerLeaveListenersRef = useRef(new Map());
    const {clickListener} = useStore();

    // Garder trace des objets actuellement survolés
    const hoveredObjectsRef = useRef(new Set());

    // Référence pour stocker les objets à suivre (optimization)
    const trackableObjectsRef = useRef([]);

    // Flag pour indiquer que la liste des objets trackables doit être mise à jour
    const needsUpdateRef = useRef(false);

    // ✅ NOUVEAU : Fonction pour vérifier si un objet est raycastable
    const isObjectRaycastable = useCallback((object) => {
        // 1. Vérification explicite via userData
        if (object.userData?.raycastable === false) {
            return false;
        }

        // 2. Vérification du type d'objet dans userData
        if (object.userData?.type === 'grass' ||
            object.userData?.type === 'decoration' ||
            object.userData?.type === 'performance-heavy') {
            return false;
        }

        // 3. Vérification par nom d'objet (patterns courants)
        const name = object.name?.toLowerCase() || '';
        const excludedNames = ['grass', 'particle', 'effect', 'background', 'skybox'];
        if (excludedNames.some(excluded => name.includes(excluded))) {
            return false;
        }

        // 4. Vérification des InstancedMesh avec beaucoup d'instances
        if (object.isInstancedMesh && object.count > 10) {
            console.warn(`⚠️ RayCaster: InstancedMesh "${object.name || 'unnamed'}" avec ${object.count} instances exclu du raycasting pour les performances`);
            return false;
        }

        // 5. Vérification des layers (layer 1 = exclus par défaut)
        if (object.layers.mask === 2) { // Layer 1 (2^1)
            return false;
        }

        // 6. Vérification si l'objet a une méthode raycast personnalisée qui ne fait rien
        if (object.raycast && object.raycast.toString().includes('{}')) {
            return false;
        }

        return true;
    }, []);

    // ✅ OPTIMISÉ : Fonction pour mettre à jour la liste des objets à suivre
    const updateTrackableObjects = useCallback(() => {
        // Ne nécessite pas d'une mise à jour si aucun écouteur n'est enregistré
        if (
            pointerEnterListenersRef.current.size === 0 &&
            pointerLeaveListenersRef.current.size === 0 &&
            clickListenersRef.current.size === 0
        ) {
            trackableObjectsRef.current = [];
            return;
        }

        const trackableUuids = new Set([
            ...pointerEnterListenersRef.current.keys(),
            ...pointerLeaveListenersRef.current.keys(),
            ...clickListenersRef.current.keys()
        ]);

        const trackableObjects = [];
        let excludedCount = 0;

        // ✅ Première passe : objets avec UUID spécifiques
        scene.traverse((object) => {
            if (!object.isMesh) return;

            if (!isObjectRaycastable(object)) {
                excludedCount++;
                return;
            }

            if (trackableUuids.has(object.uuid)) {
                trackableObjects.push(object);
            }
        });

        // ✅ Deuxième passe : mode fallback avec filtrage intelligent
        if (trackableObjects.length === 0 && trackableUuids.size > 0) {
            scene.traverse((object) => {
                if (object.isMesh && isObjectRaycastable(object)) {
                    trackableObjects.push(object);
                }
            });
        }

        trackableObjectsRef.current = trackableObjects;
        needsUpdateRef.current = false;

        // ✅ Logging pour debug
        console.log(`🎯 RayCaster: ${trackableObjects.length} objets raycastables, ${excludedCount} exclus`);
    }, [scene, isObjectRaycastable]);

    // ✅ OPTIMISÉ : Throttling adaptatif basé sur le nombre d'objets
    const getOptimalThrottleDelay = useCallback(() => {
        const objectCount = trackableObjectsRef.current.length;
        if (objectCount > 100) return 48; // 30 FPS pour beaucoup d'objets
        if (objectCount > 10) return 32;  // 40 FPS
        if (objectCount > 10) return 32;  // 50 FPS
        return 16; // 60 FPS pour peu d'objets
    }, []);

    // Fonction pour limiter la fréquence des calculs de raycasting
    const createThrottledHandler = useCallback((handler) => {
        let lastCall = 0;
        return function(...args) {
            const now = performance.now();
            const delay = getOptimalThrottleDelay();

            if (now - lastCall >= delay) {
                lastCall = now;
                return handler(...args);
            }
        };
    }, [getOptimalThrottleDelay]);

    // Fonction pour trouver un écouteur en remontant l'arbre des objets
    const findListenerInAncestors = (object, listenersMap) => {
        let currentObject = object;
        while (currentObject) {
            const uuid = currentObject.uuid;
            if (listenersMap.has(uuid)) {
                return {
                    uuid,
                    callback: listenersMap.get(uuid),
                    object: currentObject
                };
            }
            currentObject = currentObject.parent;
        }
        return null;
    };

    // ✅ OPTIMISÉ : Gérer les événements de mouvement de souris pour les survols
    useEffect(() => {
        const canvas = gl.domElement;

        // Mettre à jour la liste des objets à suivre initialement
        updateTrackableObjects();

        const handlePointerMove = createThrottledHandler((event) => {
            if (pointerEnterListenersRef.current.size === 0 && pointerLeaveListenersRef.current.size === 0) {
                return;
            }

            // Si la liste des objets à suivre doit être mise à jour
            if (needsUpdateRef.current) {
                updateTrackableObjects();
            }

            // Performance check
            if (trackableObjectsRef.current.length === 0) {
                return;
            }

            // Normalisation des coordonnées de la souris (-1 à 1)
            const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

            // Mise à jour du raycaster avec les coordonnées de la souris
            raycaster.setFromCamera({x: mouseX, y: mouseY}, camera);

            // ✅ Obtenir tous les objets intersectés avec la liste filtrée
            const intersects = raycaster.intersectObjects(trackableObjectsRef.current, true);

            // Ensemble pour suivre les objets actuellement intersectés
            const currentlyIntersected = new Set();

            // Parcourir toutes les intersections (traverser les objets)
            for (const intersection of intersects) {
                const listener = findListenerInAncestors(intersection.object, pointerEnterListenersRef.current);

                if (listener) {
                    const {uuid, callback, object} = listener;

                    // Ajouter à l'ensemble des objets intersectés
                    currentlyIntersected.add(uuid);

                    // Si ce n'était pas déjà survolé, déclencher onPointerEnter
                    if (!hoveredObjectsRef.current.has(uuid)) {
                        hoveredObjectsRef.current.add(uuid);
                        callback(intersection, event, object);
                    }
                }
            }

            // Vérifier les objets qui ne sont plus survolés
            for (const uuid of hoveredObjectsRef.current) {
                if (!currentlyIntersected.has(uuid) && pointerLeaveListenersRef.current.has(uuid)) {
                    // Déclencher onPointerLeave
                    const callback = pointerLeaveListenersRef.current.get(uuid);
                    callback(event);
                    hoveredObjectsRef.current.delete(uuid);
                }
            }
        });

        // S'abonner aux événements de mouvement de souris
        if (canvas) {
            canvas.addEventListener('pointermove', handlePointerMove);

            return () => {
                canvas.removeEventListener('pointermove', handlePointerMove);
            };
        }
    }, [gl, raycaster, camera, scene, updateTrackableObjects, createThrottledHandler]);

    // ✅ OPTIMISÉ : S'abonner aux événements de clic sur le canvas
    useEffect(() => {
        const canvas = gl.domElement;

        const handleClick = (event) => {
            if (!clickListener?.isListening && clickListenersRef.current.size === 0) {
                return;
            }

            // Si la liste des objets à suivre doit être mise à jour
            if (needsUpdateRef.current) {
                updateTrackableObjects();
            }

            // Performance check
            if (trackableObjectsRef.current.length === 0) {
                return;
            }

            // Normalisation des coordonnées de la souris (-1 à 1)
            const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

            // Mise à jour du raycaster avec les coordonnées de la souris
            raycaster.setFromCamera({x: mouseX, y: mouseY}, camera);

            // ✅ Obtenir tous les objets intersectés avec la liste filtrée
            const intersects = raycaster.intersectObjects(trackableObjectsRef.current, true);

            // Parcourir tous les objets intersectés (traverser les éléments)
            for (const intersection of intersects) {
                const listener = findListenerInAncestors(intersection.object, clickListenersRef.current);

                if (listener) {
                    listener.callback(intersection, event);
                    // Ne pas arrêter ici pour permettre à tous les écouteurs de réagir
                }
            }
        };

        // Ajouter l'écouteur si le canvas existe
        if (canvas) {
            canvas.addEventListener('click', handleClick);

            return () => {
                canvas.removeEventListener('click', handleClick);
            };
        }
    }, [gl, raycaster, camera, scene, clickListener, updateTrackableObjects]);

    // Méthode pour ajouter un écouteur de clic à un objet spécifique
    const addClickListener = useCallback((uuid, callback) => {
        clickListenersRef.current.set(uuid, callback);
        needsUpdateRef.current = true;
        return () => {
            clickListenersRef.current.delete(uuid);
            needsUpdateRef.current = true;
        };
    }, []);

    // Méthodes pour ajouter des écouteurs de pointeur
    const addPointerEnterListener = useCallback((uuid, callback) => {
        pointerEnterListenersRef.current.set(uuid, callback);
        needsUpdateRef.current = true;

        return () => {
            pointerEnterListenersRef.current.delete(uuid);
            needsUpdateRef.current = true;
        };
    }, []);

    const addPointerLeaveListener = useCallback((uuid, callback) => {
        pointerLeaveListenersRef.current.set(uuid, callback);
        needsUpdateRef.current = true;
        return () => {
            pointerLeaveListenersRef.current.delete(uuid);
            needsUpdateRef.current = true;
        };
    }, []);

    // Fonction pour supprimer tous les écouteurs pour un objet
    const removePointerListeners = useCallback((uuid) => {
        if (pointerEnterListenersRef.current.has(uuid)) {
            pointerEnterListenersRef.current.delete(uuid);
            needsUpdateRef.current = true;
        }

        if (pointerLeaveListenersRef.current.has(uuid)) {
            pointerLeaveListenersRef.current.delete(uuid);
            needsUpdateRef.current = true;
        }

        if (clickListenersRef.current.has(uuid)) {
            clickListenersRef.current.delete(uuid);
            needsUpdateRef.current = true;
        }

        if (hoveredObjectsRef.current.has(uuid)) {
            hoveredObjectsRef.current.delete(uuid);
        }
    }, []);

    // ✅ NOUVEAU : Méthode pour diagnostiquer les performances
    const diagnosePerformance = useCallback(() => {
        const stats = {
            trackableObjects: trackableObjectsRef.current.length,
            clickListeners: clickListenersRef.current.size,
            pointerListeners: pointerEnterListenersRef.current.size + pointerLeaveListenersRef.current.size,
            hoveredObjects: hoveredObjectsRef.current.size,
            throttleDelay: getOptimalThrottleDelay()
        };

        console.log('🔍 RayCaster Performance Diagnostic:', stats);

        // Alerter si trop d'objets trackables
        if (stats.trackableObjects > 100) {
            console.warn('⚠️ RayCaster: Beaucoup d\'objets trackables, performances possiblement impactées');
        }

        return stats;
    }, [getOptimalThrottleDelay]);

    // ✅ NOUVEAU : Méthode pour forcer l'exclusion d'un objet du raycasting
    const excludeFromRaycasting = useCallback((objectOrUuid, reason = 'manual') => {
        let targetObject = null;

        if (typeof objectOrUuid === 'string') {
            // Chercher par UUID
            scene.traverse((obj) => {
                if (obj.uuid === objectOrUuid) {
                    targetObject = obj;
                }
            });
        } else {
            targetObject = objectOrUuid;
        }

        if (targetObject) {
            targetObject.userData.raycastable = false;
            targetObject.userData.raycastExclusionReason = reason;
            needsUpdateRef.current = true;
            console.log(`🚫 Objet exclu du raycasting: ${targetObject.name || targetObject.uuid} (${reason})`);
        }
    }, [scene]);

    // Méthode pour tester manuellement une intersection
    const testIntersection = useCallback((x, y) => {
        const normalizedX = (x / window.innerWidth) * 2 - 1;
        const normalizedY = -(y / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera({x: normalizedX, y: normalizedY}, camera);

        // Si la liste des objets à suivre doit être mise à jour
        if (needsUpdateRef.current) {
            updateTrackableObjects();
        }

        return raycaster.intersectObjects(trackableObjectsRef.current, true);
    }, [camera, raycaster, updateTrackableObjects]);

    // ✅ Contexte exposé avec nouvelles méthodes
    const contextValue = {
        addClickListener,
        addPointerEnterListener,
        addPointerLeaveListener,
        removePointerListeners,
        testIntersection,
        diagnosePerformance,
        excludeFromRaycasting
    };

    return (
        <RayCasterContext.Provider value={contextValue}>
            {children}
        </RayCasterContext.Provider>
    );
};

/**
 * Hook pour utiliser le RayCaster
 */
export const useRayCaster = () => {
    const context = useContext(RayCasterContext);

    if (!context) {
        throw new Error('useRayCaster must be used within a RayCaster provider');
    }

    return context;
};

export default RayCaster;