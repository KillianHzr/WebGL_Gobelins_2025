import React, {useEffect, useMemo, useState} from 'react';
import {useThree} from '@react-three/fiber';
import Forest from './Forest';
import {EventBus, useEventEmitter} from '../Utils/EventEmitter';
import MapWithInstances from "./MapWithInstances.jsx";
import WaterPlane from './WaterPlane';

export default function ForestScene() {
    const [mapReady, setMapReady] = useState(false);
    const [forestReady, setForestReady] = useState(false);
    const eventEmitter = useEventEmitter();
    const {scene, gl} = useThree();

    useEffect(() => {

        // Gestionnaires d'événements optimisés
        const mapReadyHandler = () => {
            console.log('Map est prête');
            setMapReady(true);
        };

        const forestReadyHandler = () => {
            console.log('Forest est prête');
            setForestReady(true);
        };

        // Utiliser EventBus pour s'abonner aux événements
        const mapUnsubscribe = EventBus.on('map-ready', mapReadyHandler);
        const forestUnsubscribe = EventBus.on('forest-ready', forestReadyHandler);

        // Nettoyage lors du démontage
        return () => {
            mapUnsubscribe();
            forestUnsubscribe();

            // Retirer les lumières de la scène
            scene.remove(ambientLight);
            scene.remove(mainLight);
        };
    }, [scene, gl]);

    useEffect(() => {
        // Lorsque les deux composants sont prêts
        if (mapReady && forestReady) {
            console.log('La scène forestière est entièrement chargée');
            // Émettre un événement pour indiquer que tout est prêt
            EventBus.trigger('forest-scene-ready');

            // Afficher les instructions de contrôle
            console.log(`
INSTRUCTIONS DE CONTRÔLE:
- Touche E: Afficher/Masquer le groupe des objets "End"
- Touche S: Afficher/Masquer le groupe des écrans
`);
        }
    }, [mapReady, forestReady]);

    // Utiliser useMemo pour éviter les re-rendus inutiles
    const mapComponent = useMemo(() => <MapWithInstances/>, []);
    const forestComponent = useMemo(() => <Forest/>, []);
    const waterComponent = useMemo(() => <WaterPlane/>, []);

    return (
        <>
            {/*{mapComponent}*/}
            {forestComponent}
            {waterComponent}
        </>
    );
}