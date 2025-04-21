import React, {useEffect, useRef, useState} from 'react'
import {useThree} from '@react-three/fiber'
import useStore from './Store/useStore'
import ScrollControls from './Core/ScrollControls'
import {initializeLight} from "./Utils/defaultValues.js";
import DebugInitializer from "./Utils/DebugInitializer.jsx";
import Debug from "./Utils/Debug.jsx";
import Camera from "./Core/Camera.jsx";
import Controls from "./Core/Controls.jsx";
import Lights from "./Core/Lights.jsx";
import Stats from "./Utils/Stats.jsx";
import RayCaster from "./Utils/RayCaster.jsx";
import {EventBus, EventEmitterProvider} from './Utils/EventEmitter';
import AudioManagerComponent from './Utils/AudioManager';
import InteractiveMarkersProvider from './Utils/MarkerSystem';
import EnhancedCube from "./World/EnhancedCube.jsx";
import MARKER_EVENTS from "./Utils/EventEmitter.jsx";

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
            const {setWaitingForInteraction, setCurrentStep} = useStore.getState().interaction;
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

    return (<EventEmitterProvider>
        <DebugInitializer/>
        <AudioManagerComponent/>

        {debug?.active && debug?.showStats && <Stats/>}
        {debug?.active && debug?.showGui && <Debug/>}
        {debug?.active && debug?.showGui && <Camera/>}
        {debug?.active && debug?.showGui && <Controls/>}
        {debug?.active && debug?.showGui && <Lights/>}

        <RayCaster>
            <InteractiveMarkersProvider>
                <ScrollControls>
                    {/* Lights */}
                    <ambientLight intensity={0.5}/>
                    <directionalLight position={[1, 2, 3]} intensity={1.5}/>
                    <color attach="background" args={['#1e1e2f']}/>
                    {/* Objects */}
                    {loaded && (<>
                        <EnhancedCube/>
                    </>)}
                </ScrollControls>
            </InteractiveMarkersProvider>
        </RayCaster>
    </EventEmitterProvider>)
}