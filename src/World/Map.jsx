import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Group } from 'three';
import useStore from '../Store/useStore';
import { EventBus, useEventEmitter } from '../Utils/EventEmitter';

export default function Map() {
    const { scene } = useThree();
    const mapRef = useRef(new Group());
    const assetManager = window.assetManager;
    const eventEmitter = useEventEmitter();

    useEffect(() => {
        // Create main map group
        const mapGroup = mapRef.current;
        mapGroup.name = 'Map';
        scene.add(mapGroup);

        const loadMap = () => {
            // Load and add map
            if (assetManager?.getItem && assetManager.getItem('Map')) {
                const mapModel = assetManager.getItem('Map').scene.clone();
                mapModel.name = 'MapModel';
                mapGroup.add(mapModel);

                // Position and scale map as needed
                mapModel.position.set(0, 0, 0);
                mapModel.scale.set(1, 1, 1);

                console.log('Map loaded and positioned');

                // Utiliser EventBus pour émettre l'événement
                EventBus.trigger('map-ready');
            } else {
                console.warn('Map model not found in asset manager');

                // Si assetManager n'est pas encore prêt, réessayer après un délai
                if (!assetManager?.getItem) {
                    console.log('AssetManager not ready yet, retrying in 500ms...');
                    setTimeout(loadMap, 500);
                }
            }
        };

        // Première tentative de chargement
        loadMap();

        // Cleanup function
        return () => {
            if (mapGroup) {
                scene.remove(mapGroup);

                // Clean up all children
                mapGroup.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }
        };
    }, [scene, assetManager]);

    // This component doesn't render any visible elements by itself
    return null;
}