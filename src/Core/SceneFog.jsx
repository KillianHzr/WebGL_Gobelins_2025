import { useEffect, useRef } from 'react';
import {useThree } from '@react-three/fiber';
import { Color, Fog } from 'three';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {useAnimationFrame} from "../Utils/AnimationManager.js";

/**
 * Composant qui gère uniquement le brouillard (fog) dans la scène
 */
const SceneFog = () => {
    const { scene } = useThree();
    const timelinePosition = useStore(state => state.timelinePosition);
    const sequenceLength = useStore(state => state.sequenceLength);
    const debug = useStore(state => state.debug);
    const gui = useStore(state => state.gui);

    // Références pour suivre l'état
    const guiInitializedRef = useRef(false);
    const fogColorRef = useRef(null);

    // Configuration de base pour le brouillard
    const fogConfigRef = useRef({
        enabled: true,
        color: guiConfig.scene.fog.color.color,
        startPoint: guiConfig.scene.fog.transition?.startPoint?.default || 0.3,
        endPoint: guiConfig.scene.fog.transition?.endPoint?.default || 0.7,
        initialNear: guiConfig.scene.fog.transition.initialNear.default,
        initialFar: guiConfig.scene.fog.transition.initialFar.default,
        targetNear: guiConfig.scene.fog.near.default,
        targetFar: guiConfig.scene.fog.far.default
    });

    // Initialiser le brouillard
    useEffect(() => {
        if (!scene) return;

        // Initialiser la couleur du brouillard
        fogColorRef.current = new Color(fogConfigRef.current.color);

        // Initialiser le brouillard avec les valeurs configurées
        scene.fog = new Fog(
            fogColorRef.current,
            fogConfigRef.current.initialNear,
            fogConfigRef.current.initialFar
        );
        scene.background = fogColorRef.current;

        console.log(`Brouillard initialisé avec la couleur ${fogColorRef.current.getHexString()}`);

        // Nettoyage lors du démontage
        return () => {
            if (scene.fog) {
                scene.fog = null;
            }
        };
    }, [scene]);

    // Initialiser les contrôles GUI en mode debug
    useEffect(() => {
        if (debug?.active && gui && !guiInitializedRef.current && scene.fog) {
            // Trouver ou créer le dossier Scene
            let sceneFolder = gui.folders?.find(folder => folder.name === 'Scene');
            if (!sceneFolder) {
                sceneFolder = gui.addFolder('Scene');
            }

            // Créer un dossier pour le brouillard
            const fogFolder = sceneFolder.addFolder('Fog');

            // Objet pour le contrôle
            const fogControls = {
                color: fogConfigRef.current.color,
                near: fogConfigRef.current.targetNear,
                far: fogConfigRef.current.targetFar,
                startPoint: fogConfigRef.current.startPoint,
                endPoint: fogConfigRef.current.endPoint
            };

            // Ajouter les contrôles
            fogFolder.addColor(fogControls, 'color')
                .name('Couleur du brouillard')
                .onChange(value => {
                    if (scene.fog) {
                        scene.fog.color.set(value);
                        fogConfigRef.current.color = value;
                    }
                });

            fogFolder.add(fogControls, 'near', 0, 50, 0.1)
                .name('Distance minimale')
                .onChange(value => {
                    fogConfigRef.current.targetNear = value;
                });

            fogFolder.add(fogControls, 'far', 5, 100, 0.1)
                .name('Distance maximale')
                .onChange(value => {
                    fogConfigRef.current.targetFar = value;
                });

            // Contrôles de transition
            const transitionFolder = fogFolder.addFolder('Transition');

            transitionFolder.add(fogControls, 'startPoint', 0, 1, 0.01)
                .name('Début transition')
                .onChange(value => {
                    fogConfigRef.current.startPoint = value;
                });

            transitionFolder.add(fogControls, 'endPoint', 0, 1, 0.01)
                .name('Fin transition')
                .onChange(value => {
                    fogConfigRef.current.endPoint = value;
                });

            guiInitializedRef.current = true;
        }
    }, [debug, gui, scene.fog]);

    // Mettre à jour le brouillard en fonction de la position de défilement
    useAnimationFrame(() => {
        if (!scene.fog || sequenceLength <= 0) return;

        // Récupérer la configuration actuelle
        const config = fogConfigRef.current;

        // Calculer la progression du défilement (0 à 1)
        const scrollProgress = Math.max(0, Math.min(1, timelinePosition / sequenceLength));

        // Calculer l'intensité du brouillard en fonction de la progression
        let fogIntensity = 0;
        if (scrollProgress > config.startPoint) {
            fogIntensity = Math.min(1, (scrollProgress - config.startPoint) / (config.endPoint - config.startPoint));
        }

        // Interpoler les valeurs du brouillard entre les valeurs initiales et cibles
        const currentNear = config.initialNear - (config.initialNear - config.targetNear) * fogIntensity;
        const currentFar = config.initialFar - (config.initialFar - config.targetFar) * fogIntensity;

        // Mettre à jour le brouillard
        scene.fog.near = currentNear;
        scene.fog.far = currentFar;
    }, 'postProcess'); // Catégorie 'postProcess' car lié au rendu


    // Ce composant ne rend rien visuellement, il modifie uniquement scene.fog
    return null;
};

export default SceneFog;