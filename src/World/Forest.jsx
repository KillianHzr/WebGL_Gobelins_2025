import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Group } from 'three';
import { EventBus, useEventEmitter } from '../Utils/EventEmitter';
import useStore from '../Store/useStore';

export default function Forest() {
    const { scene } = useThree();
    const forestRef = useRef(new Group());
    const assetManager = window.assetManager;
    const eventEmitter = useEventEmitter();

    // References for individual tree models
    const tree1Refs = useRef([]);
    const tree2Refs = useRef([]);
    const tree3Refs = useRef([]);

    useEffect(() => {
        // Create main forest group
        const forestGroup = forestRef.current;
        forestGroup.name = 'Forest';
        scene.add(forestGroup);

        // Function to create and position trees
        const createTrees = (treeName, refsArray, positions) => {
            if (assetManager?.getItem && assetManager.getItem(treeName)) {
                positions.forEach((pos) => {
                    const treeModel = assetManager.getItem(treeName).scene.clone();
                    treeModel.name = `${treeName}_${refsArray.length}`;
                    treeModel.position.set(pos.x, pos.y, pos.z);

                    // Random rotation for natural look
                    treeModel.rotation.y = Math.random() * Math.PI * 2;

                    // Random scale variation
                    const scale = 0.8 + Math.random() * 0.4;
                    treeModel.scale.set(scale, scale, scale);

                    forestGroup.add(treeModel);
                    refsArray.push(treeModel);
                });
                return true;
            } else {
                console.warn(`${treeName} model not found in asset manager`);
                return false;
            }
        };

        const loadForest = () => {
            // Vérifier si l'AssetManager est prêt
            if (!assetManager?.getItem) {
                console.log('AssetManager not ready yet, retrying in 500ms...');
                setTimeout(loadForest, 500);
                return;
            }

            // Define positions for different tree types
            const tree1Positions = [
                { x: 5, y: 0, z: 3 },
                // { x: -4, y: 0, z: 5 },
                // { x: 7, y: 0, z: -2 },
                // { x: -6, y: 0, z: -4 }
            ];

            const tree2Positions = [
                { x: 3, y: 0, z: -5 },
                // { x: -2, y: 0, z: 7 },
                // { x: 8, y: 0, z: 4 },
                // { x: -7, y: 0, z: -1 }
            ];

            const tree3Positions = [
                { x: 1, y: 0, z: 6 },
                // { x: -5, y: 0, z: -3 },
                // { x: 6, y: 0, z: 1 },
                // { x: -3, y: 0, z: -6 }
            ];

            // Create trees of each type
            const tree1Success = createTrees('Tree1', tree1Refs.current, tree1Positions);
            const tree2Success = createTrees('Tree2', tree2Refs.current, tree2Positions);
            const tree3Success = createTrees('Tree3', tree3Refs.current, tree3Positions);

            if (tree1Success && tree2Success && tree3Success) {
                console.log('Forest trees loaded and positioned');

                // Utiliser EventBus pour émettre l'événement
                EventBus.trigger('forest-ready');
            } else {
                console.warn('Some tree models could not be loaded');
            }
        };

        // Première tentative de chargement
        loadForest();

        // Cleanup function
        return () => {
            // Remove forest group from scene
            if (forestGroup) {
                scene.remove(forestGroup);

                // Clean up all tree instances
                [...tree1Refs.current, ...tree2Refs.current, ...tree3Refs.current].forEach(tree => {
                    if (tree) {
                        forestGroup.remove(tree);
                        tree.traverse((child) => {
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
                });
            }
        };
    }, [scene, assetManager]);

    return null;
}