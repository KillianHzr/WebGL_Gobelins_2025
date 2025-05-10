import React, {useEffect, useMemo, useRef} from 'react'
import {useThree} from '@react-three/fiber'
import useStore from './Store/useStore'
import ScrollControls from './Core/ScrollControls'
import DebugInitializer from "./Utils/DebugInitializer.jsx";
import Debug from "./Utils/Debug.jsx";
import Camera from "./Core/Camera.jsx";
import CameraSwitcher from './Utils/CameraSwitcher.jsx';
import Controls from "./Core/Controls.jsx";
import Lights from "./Core/Lights.jsx";
import MaterialControls from "./Core/MaterialControls.jsx";
import PostProcessing from "./Core/PostProcessing.jsx";
import Stats from "./Utils/Stats.jsx";
import RayCaster from "./Utils/RayCaster.jsx";
import {EventBus, EventEmitterProvider} from './Utils/EventEmitter';
import ForestSceneWrapper from './World/ForestSceneWrapper';
import AudioManagerComponent from './Utils/AudioManager';
import InteractiveMarkersProvider from './Utils/MarkerSystem';
import MARKER_EVENTS from "./Utils/EventEmitter.jsx";
import SceneObjects from './World/SceneObjects';
import guiConfig from "./Config/guiConfig.js";
import Flashlight from "./World/Flashlight.jsx";
import BackgroundWithFog from './Core/BackgroundWithFog'; // Importer notre nouveau composant intégré
import NarrationTriggers from './Utils/NarrationTriggers';

// Helper pour les logs conditionnels
const debugLog = (message, ...args) => {
    console.log(`[Experience] ${message}`, ...args);
};

export default function Experience() {
    const {loaded, debug, setCamera, setCameraInitialZoom} = useStore()
    const {scene, camera, gl} = useThree()  // Récupérer gl à partir de useThree
    const eventListenersRef = useRef([]);
    const isMountedRef = useRef(true);

    useEffect(() => {
        if (!gl) return;

        // Appliquer les mêmes paramètres que ceux utilisés en mode debug
        const debugConfig = guiConfig.renderer;

        gl.shadowMap.enabled = debugConfig.shadowMap.enabled.default;
        gl.shadowMap.type = debugConfig.shadowMap.type.default;
        gl.toneMapping = debugConfig.toneMapping.default;
        gl.toneMappingExposure = debugConfig.toneMappingExposure.default;

        debugLog('Renderer initialized with consistent settings');
    }, [gl]);

    // Gestion optimisée des événements des marqueurs
    useEffect(() => {
        // Ne procéder que si le composant est monté
        if (!isMountedRef.current) return;

        debugLog('Setting up marker event handlers');

        // Fonction optimisée pour gérer les clics de marqueurs
        const markerClickHandler = (data) => {
            debugLog('Marqueur cliqué:', data);
        };

        // Fonction optimisée pour gérer les événements d'interaction
        const interactionRequiredHandler = (data) => {
            debugLog('Interaction requise:', data);

            // Récupérer l'état global de manière optimisée
            const store = useStore.getState();
            const interaction = store.interaction;

            // Déclencher l'interaction dans le store si nécessaire et disponible
            if (interaction && typeof interaction.setWaitingForInteraction === 'function' &&
                typeof interaction.setCurrentStep === 'function') {
                interaction.setWaitingForInteraction(true);
                interaction.setCurrentStep(data.id);
            }
        };

        // Fonction optimisée pour gérer le survol des marqueurs
        const markerHoverHandler = (data) => {
            debugLog('Marqueur survolé:', data);
        };

        // S'abonner aux événements avec gestion des erreurs
        try {
            const cleanupClickEvent = EventBus.on(MARKER_EVENTS.MARKER_CLICK, markerClickHandler);
            const cleanupHoverEvent = EventBus.on(MARKER_EVENTS.MARKER_HOVER, markerHoverHandler);
            const cleanupInteractionEvent = EventBus.on(MARKER_EVENTS.INTERACTION_REQUIRED, interactionRequiredHandler);

            // Stocker les références pour le nettoyage
            eventListenersRef.current = [
                cleanupClickEvent,
                cleanupHoverEvent,
                cleanupInteractionEvent
            ];
        } catch (error) {
            console.error('Error setting up marker event handlers:', error);
        }

        // Nettoyage optimisé lors du démontage
        return () => {
            // Nettoyer tous les écouteurs d'événements
            eventListenersRef.current.forEach(cleanup => {
                try {
                    if (typeof cleanup === 'function') {
                        cleanup();
                    }
                } catch (error) {
                    console.warn('Error cleaning up event listener:', error);
                }
            });

            // Vider la liste
            eventListenersRef.current = [];
        };
    }, []);

    // Configurer la caméra de manière optimisée
    useEffect(() => {
        if (!camera) return;

        setCamera(camera);
        setCameraInitialZoom(camera.zoom);
    }, [camera, setCamera, setCameraInitialZoom]);

    // Appliquer les valeurs par défaut aux lumières lors du montage - optimisé
    useEffect(() => {
        // Ne procéder que si la scène est disponible et le composant monté
        if (!scene || !isMountedRef.current) return;


        // Nettoyage lors du démontage
        return () => {
            // Pas besoin de nettoyer les lumières, elles seront gérées par Three.js
        };
    }, [scene, debug]);

    // Marquer le composant comme démonté lors du nettoyage
    useEffect(() => {
        // Initialiser
        isMountedRef.current = true;

        // Nettoyer
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Optimiser le rendu de la scène forestière avec useMemo
    const forestScene = useMemo(() => <ForestSceneWrapper/>, []);

    return (
        <EventEmitterProvider>
            <DebugInitializer/>
            <AudioManagerComponent/>
            <NarrationTriggers/>
            <CameraSwitcher/>
            {/*<CameraModeSync/>*/}
            {/* Ajouter notre nouveau composant qui gère à la fois l'image de fond et le brouillard */}
            <BackgroundWithFog />

            <Stats/>
            <Debug/>
            <Camera/>
            <Controls/>
            <Lights/>
            <MaterialControls/>
            <PostProcessing/>
            <RayCaster>
                <InteractiveMarkersProvider>
                    <ScrollControls>
                        {/* Le composant SceneObjects contient tous les objets statiques de la scène */}
                        <SceneObjects/>

                        {/* La forêt avec ses instances nombreuses (instanced meshes) */}
                        {forestScene}

                        {/* Ajout du composant Flashlight */}
                        <Flashlight/>

                    </ScrollControls>
                </InteractiveMarkersProvider>
            </RayCaster>
        </EventEmitterProvider>
    )
}