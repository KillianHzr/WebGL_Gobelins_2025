import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import useStore from '../Store/useStore';

// Contexte pour le RayCaster
const RayCasterContext = createContext(null);

/**
 * Composant RayCaster qui gère la détection des clics dans la scène 3D
 */
const RayCaster = ({ children }) => {
    // Récupérer la scène en plus des autres éléments
    const { raycaster, camera, gl, scene } = useThree();
    const clickListenersRef = useRef(new Map());
    const { clickListener } = useStore();

    // S'abonner aux événements de clic sur le canvas
    useEffect(() => {
        const canvas = gl.domElement;

        const handleClick = (event) => {
            console.log('[RayCaster] Click event captured');

            if (!clickListener?.isListening || clickListenersRef.current.size === 0) {
                console.log('[RayCaster] Not listening or no listeners registered');
                return;
            }

            // Normalisation des coordonnées de la souris (-1 à 1)
            const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

            // Mise à jour du raycaster avec les coordonnées de la souris
            raycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);

            // Récupérer tous les objets de la scène
            const allObjects = [];
            scene.traverse((object) => {
                if (object.isMesh) {
                    console.log('Found mesh:', object.name || object.uuid);
                    allObjects.push(object);
                }
            });

            // Obtenir tous les objets intersectés en passant la liste complète
            const intersects = raycaster.intersectObjects(allObjects, true);

            console.log('[RayCaster] Intersections found:', intersects.length);

            if (intersects.length > 0) {
                console.log('[RayCaster] First intersection:', intersects[0].object.name || intersects[0].object.uuid);

                // Parcourir les objets intersectés
                for (const intersection of intersects) {
                    // Remonter l'arbre des objets pour trouver celui avec un écouteur
                    let currentObject = intersection.object;

                    while (currentObject) {
                        const uuid = currentObject.uuid;

                        if (clickListenersRef.current.has(uuid)) {
                            console.log('[RayCaster] Found listener for:', currentObject.name || uuid);
                            const callback = clickListenersRef.current.get(uuid);
                            callback(intersection, event);
                            return; // Arrêter après avoir trouvé le premier objet avec un écouteur
                        }

                        currentObject = currentObject.parent;
                    }
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
    }, [gl, raycaster, camera, scene, clickListener]);
    // Méthode pour ajouter un écouteur de clic à un objet spécifique
    const addClickListener = (uuid, callback) => {
        clickListenersRef.current.set(uuid, callback);
        return () => clickListenersRef.current.delete(uuid);
    };

    // Méthode pour tester manuellement une intersection
    const testIntersection = (x, y) => {
        const normalizedX = (x / window.innerWidth) * 2 - 1;
        const normalizedY = -(y / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera({ x: normalizedX, y: normalizedY }, camera);
        return raycaster.intersectObjects([], true);
    };

    // Contexte exposé
    const contextValue = {
        addClickListener,
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