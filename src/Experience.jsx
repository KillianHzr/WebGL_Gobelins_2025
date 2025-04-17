import React, {useEffect, useRef, useState} from 'react'
import {useFrame, useThree} from '@react-three/fiber'
import {OrbitControls} from '@react-three/drei'
import useStore from './Store/useStore'
import Cube from './World/Cube'
import ScrollControls from './Core/ScrollControls'
import {initializeLight} from "./Utils/defaultValues.js";
import DebugInitializer from "./Utils/DebugInitializer.jsx";
import Debug from "./Utils/Debug.jsx";
import Camera from "./Core/Camera.jsx";
import Controls from "./Core/Controls.jsx";
import Lights from "./Core/Lights.jsx";
import Stats from "./Utils/Stats.jsx";
import RayCaster from "./Utils/RayCaster.jsx";
import { EventEmitterProvider } from './Utils/EventEmitter';
import { EventBus } from './Utils/EventEmitter';
import AudioManagerComponent from './Utils/AudioManager';

// Import des composants liés aux marqueurs interactifs
import InteractiveMarkersProvider, { InteractiveMarker, MARKER_TYPES } from './Utils/MarkerSystem';
import { MARKER_EVENTS } from './Utils/markerEvents';
import EnhancedCube from "./World/EnhancedCube.jsx";

// Configuration des marqueurs de démonstration
const demoMarkerConfig = {
    groups: [
        {
            id: 'main-points',
            name: 'Points principaux',
            description: 'Points d\'intérêt majeurs dans la scène',
            isVisible: true
        },
        {
            id: 'secondary-points',
            name: 'Points secondaires',
            description: 'Détails et informations complémentaires',
            isVisible: true
        }
    ],
    markers: [
        {
            id: 'marker-1',
            title: 'Point d\'information',
            description: 'Ceci est un point d\'information standard',
            position: { x: 0, y: 1.5, z: 0 },
            ctaType: MARKER_TYPES.INFO,
            color: '#00aaff',
            scale: 1.2,
            groupId: 'main-points',
            targetView: {
                position: { x: 3, y: 2, z: 3 },
                lookAt: { x: 0, y: 0, z: 0 }
            }
        },
        {
            id: 'marker-2',
            title: 'Point d\'avertissement',
            description: 'Attention requise à cet endroit',
            position: { x: 2, y: 0.5, z: 2 },
            ctaType: MARKER_TYPES.WARNING,
            color: '#ff8800',
            scale: 1,
            groupId: 'main-points'
        },
        {
            id: 'marker-3',
            title: 'Hotspot interactif',
            description: 'Point d\'intérêt spécial',
            position: { x: -2, y: 0.5, z: -2 },
            ctaType: MARKER_TYPES.HOTSPOT,
            color: '#ff3300',
            scale: 1,
            groupId: 'secondary-points'
        },
        {
            id: 'marker-4',
            title: 'Point d\'interaction',
            description: 'Action requise ici',
            position: { x: -2, y: 1.5, z: 2 },
            ctaType: MARKER_TYPES.INTERACTION,
            color: '#44ff44',
            scale: 1.2,
            groupId: 'main-points',
            onClick: MARKER_EVENTS.INTERACTION_REQUIRED
        },
        {
            id: 'marker-5',
            title: 'Point de navigation',
            description: 'Naviguez vers cette vue',
            position: { x: 2, y: 1.5, z: -2 },
            ctaType: MARKER_TYPES.NAVIGATION,
            color: '#00ff88',
            scale: 1.1,
            groupId: 'secondary-points',
            targetView: {
                position: { x: 3, y: 3, z: -3 },
                lookAt: { x: 2, y: 1.5, z: -2 }
            }
        },
        {
            id: 'marker-6',
            title: 'Marqueur personnalisé',
            description: 'Ce marqueur a un comportement personnalisé',
            position: { x: 0, y: 0.5, z: -3 },
            ctaType: MARKER_TYPES.CUSTOM,
            color: '#aa44ff',
            scale: 1.3,
            groupId: 'secondary-points',
            customData: {
                type: 'special-action',
                action: 'trigger-animation'
            }
        }
    ]
};

export default function Experience() {
    const {loaded, debug} = useStore()
    const {scene} = useThree()
    const ambientLightRef = useRef()
    const directionalLightRef = useRef()
    const [markersVisible, setMarkersVisible] = useState(true);

    // Gestion des événements des marqueurs
    useEffect(() => {
        // Écouter les événements de marqueurs
        const markerClickHandler = (data) => {
            console.log('Marqueur cliqué:', data);
        };

        const interactionRequiredHandler = (data) => {
            console.log('Interaction requise:', data);
            // Déclencher l'interaction dans le store si nécessaire
            const { setWaitingForInteraction, setCurrentStep } = useStore.getState().interaction;
            if (setWaitingForInteraction && setCurrentStep) {
                setWaitingForInteraction(true);
                setCurrentStep(data.id);
            }
        };

        const markerHoverHandler = (data) => {
            console.log('Marqueur survolé:', data);
        };

        // S'abonner aux événements
        const cleanupClickEvent = EventBus.on(MARKER_EVENTS.MARKER_CLICK, markerClickHandler);
        const cleanupHoverEvent = EventBus.on(MARKER_EVENTS.MARKER_HOVER, markerHoverHandler);
        const cleanupInteractionEvent = EventBus.on(MARKER_EVENTS.INTERACTION_REQUIRED, interactionRequiredHandler);

        return () => {
            // Nettoyage
            cleanupClickEvent();
            cleanupHoverEvent();
            cleanupInteractionEvent();
        };
    }, []);

    // Appliquer les valeurs par défaut aux lumières lors du montage
    useEffect(() => {
        // Initialiser les lumières avec les valeurs du guiConfig si le mode debug n'est pas actif
        if (!debug?.active) {
            if (window.__theatreStudio) {
                window.__theatreStudio.ui.hide();
            }

            scene.traverse((object) => {
                if (object.isLight) {
                    const lightType = object.type.replace('Light', '');

                    // Trouver l'index de cette lumière parmi les autres du même type
                    let index = 0;
                    let foundLights = 0;
                    scene.traverse((obj) => {
                        if (obj.isLight && obj.type === object.type) {
                            if (obj === object) {
                                index = foundLights;
                            }
                            foundLights++;
                        }
                    });

                    // Initialiser avec les valeurs par défaut
                    initializeLight(object, lightType, index);
                }
            });
        }
    }, [scene, debug]);

    return (
        <EventEmitterProvider>
            {/* Initialize debug mode based on URL hash */}
            <DebugInitializer/>

            {/* Initialize audio system */}
            <AudioManagerComponent />

            {/* Debug Tools - only render if debug mode is active */}
            {debug?.active && debug?.showStats && <Stats/>}
            {debug?.active && debug?.showGui && <Debug/>}
            {debug?.active && debug?.showGui && <Camera/>}
            {debug?.active && debug?.showGui && <Controls/>}
            {debug?.active && debug?.showGui && <Lights/>}

            {/* Ajout du système de raycasting */}
            <RayCaster>
                {/* Intégration du système de marqueurs interactifs avec la configuration */}
                <InteractiveMarkersProvider>
                    <ScrollControls>
                        {/* Lights */}
                        <ambientLight intensity={0.5}/>
                        <directionalLight position={[1, 2, 3]} intensity={1.5}/>
                        <color attach="background" args={['#1e1e2f']}/>
                        {/* Objects */}
                        {loaded && (
                            <>
                                <EnhancedCube/>
                            </>
                        )}
                    </ScrollControls>
                </InteractiveMarkersProvider>
            </RayCaster>
        </EventEmitterProvider>
    )
}