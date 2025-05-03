import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Color, Fog } from 'three';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';

/**
 * Composant ProgressiveFog - gère l'apparition progressive du brouillard
 * pendant le défilement, en synchronisation avec l'image de fond
 */
const ProgressiveFog = () => {
    const { scene } = useThree();
    const timelinePosition = useStore(state => state.timelinePosition);
    const sequenceLength = useStore(state => state.sequenceLength);
    const debug = useStore(state => state.debug);
    const gui = useStore(state => state.gui);

    // Références pour le brouillard et sa configuration
    const fogRef = useRef(null);
    const guiInitializedRef = useRef(false);

    // Configuration initiale du brouillard
    const configRef = useRef({
        startPoint: guiConfig.scene.fog.transition?.startPoint?.default || 0.25,
        endPoint: guiConfig.scene.fog.transition?.endPoint?.default || 0.75,
        initialNear: guiConfig.scene.fog.transition?.initialNear?.default || 100,
        initialFar: guiConfig.scene.fog.transition?.initialFar?.default || 120,
        targetNear: guiConfig.scene.fog.near.default,
        targetFar: guiConfig.scene.fog.far.default,
        color: guiConfig.scene.fog.color.color
    });

    // Initialiser le brouillard
    useEffect(() => {
        if (!scene) return;

        // Créer le brouillard avec des valeurs initiales (lointaines = invisible)
        const fogColor = new Color(configRef.current.color);
        const fog = new Fog(
            fogColor,
            configRef.current.initialNear,
            configRef.current.initialFar
        );

        // Appliquer à la scène
        scene.fog = fog;
        fogRef.current = fog;

        console.log('[ProgressiveFog] Fog initialized', {
            color: fogColor.getHexString(),
            near: configRef.current.initialNear,
            far: configRef.current.initialFar
        });

        // Nettoyage
        return () => {
            if (scene) {
                scene.fog = null;
                fogRef.current = null;
                console.log('[ProgressiveFog] Fog removed');
            }
        };
    }, [scene]);

    // Initialiser les contrôles GUI en mode debug
    useEffect(() => {
        if (debug?.active && gui && !guiInitializedRef.current) {
            // Trouver ou créer le dossier Scene
            let sceneFolder = gui.folders?.find(folder => folder.name === 'Scene');
            if (!sceneFolder) {
                sceneFolder = gui.addFolder('Scene');
            }

            // Créer un dossier pour le brouillard
            const fogFolder = sceneFolder.addFolder('Fog');

            // Objet pour le contrôle
            const fogControls = {
                color: configRef.current.color,
                near: configRef.current.targetNear,
                far: configRef.current.targetFar,
                startPoint: configRef.current.startPoint,
                endPoint: configRef.current.endPoint
            };

            // Ajouter les contrôles
            fogFolder.addColor(fogControls, 'color')
                .name('Couleur')
                .onChange(value => {
                    if (fogRef.current) {
                        fogRef.current.color.set(value);
                        configRef.current.color = value;
                    }
                });

            fogFolder.add(fogControls, 'near', 0, 50, 0.1)
                .name('Distance minimale')
                .onChange(value => {
                    configRef.current.targetNear = value;
                });

            fogFolder.add(fogControls, 'far', 5, 100, 0.1)
                .name('Distance maximale')
                .onChange(value => {
                    configRef.current.targetFar = value;
                });

            // Contrôles de transition
            const transitionFolder = fogFolder.addFolder('Transition');

            transitionFolder.add(fogControls, 'startPoint', 0, 1, 0.01)
                .name('Début transition')
                .onChange(value => {
                    configRef.current.startPoint = value;
                });

            transitionFolder.add(fogControls, 'endPoint', 0, 1, 0.01)
                .name('Fin transition')
                .onChange(value => {
                    configRef.current.endPoint = value;
                });

            guiInitializedRef.current = true;
        }
    }, [debug, gui]);

    // Mettre à jour le brouillard en fonction de la position de défilement
    useFrame(() => {
        if (!fogRef.current || sequenceLength <= 0) return;

        // Récupérer la configuration actuelle
        const config = configRef.current;

        // Calculer la progression du défilement (0 à 1)
        const scrollProgress = Math.max(0, Math.min(1, timelinePosition / sequenceLength));

        // Calculer l'intensité du brouillard en fonction de la progression
        let fogIntensity = 0;
        if (scrollProgress > config.startPoint) {
            fogIntensity = Math.min(1, (scrollProgress - config.startPoint) / (config.endPoint - config.startPoint));
        }

        // Interpoler les valeurs du brouillard
        const currentNear = config.initialNear - (config.initialNear - config.targetNear) * fogIntensity;
        const currentFar = config.initialFar - (config.initialFar - config.targetFar) * fogIntensity;

        // Mettre à jour le brouillard
        fogRef.current.near = currentNear;
        fogRef.current.far = currentFar;
    });

    // Ce composant ne rend rien visuellement, il modifie uniquement scene.fog
    return null;
};

export default ProgressiveFog;