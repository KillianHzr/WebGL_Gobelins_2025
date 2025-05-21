import React, {createContext, useCallback, useContext, useEffect, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';

// Contexte pour le RayCaster
const RayCasterContext = createContext(null);

/**
 * Composant RayCaster qui gère la détection des clics et pointeurs dans la scène 3D
 * avec capacité de traverser les éléments
 */
const RayCaster = ({children}) => {
    // Récupérer la scène en plus des autres éléments
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

    // Fonction pour mettre à jour la liste des objets à suivre
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

        // Trouver tous les objets avec des UUID dans notre liste
        scene.traverse((object) => {
            if (object.isMesh && trackableUuids.has(object.uuid)) {
                trackableObjects.push(object);
            }
        });

        // Si aucun objet n'est trouvé directement, il faut capturer les événements
        // pour les parents et objets partagés (pour supporter la traversée des éléments)
        if (trackableObjects.length === 0 && trackableUuids.size > 0) {
            scene.traverse((object) => {
                if (object.isMesh) {
                    trackableObjects.push(object);
                }
            });
        }

        trackableObjectsRef.current = trackableObjects;
        needsUpdateRef.current = false;
    }, [scene]);

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

    // Gérer les événements de mouvement de souris pour les survols
    useEffect(() => {
        const canvas = gl.domElement;

        // Mettre à jour la liste des objets à suivre initialement
        updateTrackableObjects();

        // Fonction pour limiter la fréquence des calculs de raycasting
        const throttle = (fn, delay) => {
            let lastCall = 0;
            return function(...args) {
                const now = performance.now();
                if (now - lastCall >= delay) {
                    lastCall = now;
                    return fn(...args);
                }
            };
        };

        const handlePointerMove = throttle((event) => {
            if (pointerEnterListenersRef.current.size === 0 && pointerLeaveListenersRef.current.size === 0) {
                return;
            }

            // Si la liste des objets à suivre doit être mise à jour
            if (needsUpdateRef.current) {
                updateTrackableObjects();
            }

            // Normalisation des coordonnées de la souris (-1 à 1)
            const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

            // Mise à jour du raycaster avec les coordonnées de la souris
            raycaster.setFromCamera({x: mouseX, y: mouseY}, camera);

            // Obtenir tous les objets intersectés avec la liste pré-calculée
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
        }, 16); // Limite à environ 60 FPS

        // S'abonner aux événements de mouvement de souris
        if (canvas) {
            canvas.addEventListener('pointermove', handlePointerMove);

            return () => {
                canvas.removeEventListener('pointermove', handlePointerMove);
            };
        }
    }, [gl, raycaster, camera, scene, updateTrackableObjects]);

    // S'abonner aux événements de clic sur le canvas
    useEffect(() => {
        const canvas = gl.domElement;

        const handleClick = (event) => {
            // console.log('[RayCaster] Click event captured');

            if (!clickListener?.isListening && clickListenersRef.current.size === 0) {
                // console.log('[RayCaster] Not listening or no listeners registered');
                return;
            }

            // Si la liste des objets à suivre doit être mise à jour
            if (needsUpdateRef.current) {
                updateTrackableObjects();
            }

            // Normalisation des coordonnées de la souris (-1 à 1)
            const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

            // Mise à jour du raycaster avec les coordonnées de la souris
            raycaster.setFromCamera({x: mouseX, y: mouseY}, camera);

            // Obtenir tous les objets intersectés avec la liste pré-calculée
            const intersects = raycaster.intersectObjects(trackableObjectsRef.current, true);

            // console.log('[RayCaster] Intersections found:', intersects.length);

            // Parcourir tous les objets intersectés (traverser les éléments)
            for (const intersection of intersects) {
                const listener = findListenerInAncestors(intersection.object, clickListenersRef.current);

                if (listener) {
                    // console.log('[RayCaster] Found listener for:', listener.object.name || listener.uuid);
                    listener.callback(intersection, event);
                    // Ne pas arrêter ici pour permettre à tous les écouteurs de réagir
                    // Si vous voulez arrêter après le premier écouteur, décommentez:
                    // break;
                }
            }
        };

        // Ajouter l'écouteur si le canvas existe
        if (canvas) {
            canvas.addEventListener('click', handleClick);

            // Nettoyer lors du démontage
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
        // Si cet uuid a déjà un écouteur, le remplacer au lieu de le doubler
        if (pointerEnterListenersRef.current.has(uuid)) {
            // console.log(`[RayCaster] Remplacement de l'écouteur pointer enter pour ${uuid}`);
        }

        pointerEnterListenersRef.current.set(uuid, callback);
        needsUpdateRef.current = true;
        // console.log(`[RayCaster] Ajout d'un écouteur pointer enter pour ${uuid}`);

        return () => {
            // console.log(`[RayCaster] Suppression de l'écouteur pointer enter pour ${uuid}`);
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

    // NOUVEAU: Fonction pour supprimer tous les écouteurs pour un objet
    const removePointerListeners = useCallback((uuid) => {
        if (pointerEnterListenersRef.current.has(uuid)) {
            pointerEnterListenersRef.current.delete(uuid);
            needsUpdateRef.current = true;
            // console.log(`[RayCaster] Removed pointer enter listener for ${uuid}`);
        }

        if (pointerLeaveListenersRef.current.has(uuid)) {
            pointerLeaveListenersRef.current.delete(uuid);
            needsUpdateRef.current = true;
            // console.log(`[RayCaster] Removed pointer leave listener for ${uuid}`);
        }

        if (clickListenersRef.current.has(uuid)) {
            clickListenersRef.current.delete(uuid);
            needsUpdateRef.current = true;
            // console.log(`[RayCaster] Removed click listener for ${uuid}`);
        }

        if (hoveredObjectsRef.current.has(uuid)) {
            hoveredObjectsRef.current.delete(uuid);
            // console.log(`[RayCaster] Removed ${uuid} from hovered objects`);
        }
    }, []);

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

    // Contexte exposé
    const contextValue = {
        addClickListener,
        addPointerEnterListener,
        addPointerLeaveListener,
        removePointerListeners,
        testIntersection
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