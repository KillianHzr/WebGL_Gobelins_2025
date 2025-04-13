import React, { useEffect, useState } from 'react';
import Map from './Map';
import Forest from './Forest';
import { EventBus, useEventEmitter } from '../Utils/EventEmitter';

export default function ForestScene() {
    const [mapReady, setMapReady] = useState(false);
    const [forestReady, setForestReady] = useState(false);
    const eventEmitter = useEventEmitter();

    useEffect(() => {
        // S'abonner aux événements de chargement
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
        };
    }, []);

    useEffect(() => {
        // Lorsque les deux composants sont prêts
        if (mapReady && forestReady) {
            console.log('La scène forestière est entièrement chargée');
            // Émettre un événement pour indiquer que tout est prêt
            EventBus.trigger('forest-scene-ready');
        }
    }, [mapReady, forestReady]);

    return (
        <>
            {/* Chargement de la map et des arbres comme composants séparés */}
            {/*<Map />*/}
            <Forest />
        </>
    );
}