import React, {useEffect, useRef} from 'react'
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
import AudioManagerComponent from './Utils/AudioManager';

export default function Experience() {
    const {loaded, debug, setCamera, setCameraInitialZoom} = useStore()
    const {scene, camera} = useThree()
    const ambientLightRef = useRef()
    const directionalLightRef = useRef()

    useEffect(() => {
        if (camera) {
            setCamera(camera);
            setCameraInitialZoom(camera.zoom);
        }
    }, [camera, setCamera, setCameraInitialZoom]);

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
            {debug?.active && debug?.showStats && <Controls/>}
            {debug?.active && debug?.showGui && <Debug/>}
            {debug?.active && debug?.showGui && <Camera/>}
            {debug?.active && debug?.showGui && <Controls/>}
            {debug?.active && debug?.showGui && <Lights/>}

            {/* Ajout du système de raycasting */}
            <RayCaster>
                <ScrollControls>
                    {/* Lights */}
                    <ambientLight intensity={0.5}/>
                    <directionalLight position={[1, 2, 3]} intensity={1.5}/>
                    <color attach="background" args={['#1e1e2f']}/>
                    <fog attach="fog" color="#1e1e2f" near={1} far={15}/>

                    {/* Objects */}
                    {loaded && (<>
                        <Cube/>
                        {/*<Cube position={[-2, 0, 0]} scale={1} color="#ff5533" />*/}
                        {/*<Cube position={[0, 0, -2]} scale={1.5} color="#5eead4" />*/}
                        {/*<Cube position={[2, 0, -4]} scale={2} color="#ffcc00" />*/}
                    </>)}
                </ScrollControls>
            </RayCaster>
        </EventEmitterProvider>
    )
}