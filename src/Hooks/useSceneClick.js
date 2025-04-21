import {useEffect, useRef} from 'react';
import useStore from '../Store/useStore';
import {useRayCaster} from '../Utils/RayCaster';
import {EventBus} from '../Utils/EventEmitter';

/**
 * Hook pour gérer les clics sur des objets 3D dans la scène
 * @param {Object} options - Options de configuration
 * @param {Object} options.objectRef - Référence à l'objet 3D (useRef)
 * @param {string} options.eventName - Nom de l'événement à émettre lors d'un clic
 * @param {boolean} options.enabled - Activer/désactiver l'écoute
 * @param {Function} options.onClick - Callback à appeler lors d'un clic
 * @param {boolean} options.debug - Activer les logs de débogage
 * @returns {Object} - État et méthodes
 */
export const useSceneClick = ({
                                  objectRef,
                                  eventName = 'object:click',
                                  enabled = true,
                                  onClick,
                                  debug = false
                              }) => {
    // État global d'écoute
    const isGlobalListening = useStore((state) => state.clickListener?.isListening || false);

    // Accès au système de raycasting
    const {addClickListener, isListening: isRayCasterListening} = useRayCaster();

    // Référence au nettoyage de l'écouteur
    const cleanupRef = useRef(null);

    // Effet pour gérer l'abonnement aux clics
    useEffect(() => {
        if (!objectRef?.current || !enabled || !isGlobalListening) return;

        // Fonction de gestion du clic
        const handleObjectClick = (intersection, event) => {
            if (debug) {
                console.log(`[useSceneClick] Object clicked:`, {
                    name: objectRef.current.name || 'unnamed',
                    uuid: objectRef.current.uuid,
                    intersection,
                    event
                });
            }

            // Construire les données du clic
            const clickData = {
                object: objectRef.current,
                intersection,
                timestamp: Date.now(),
                originalEvent: event,
                point: intersection.point,
                distance: intersection.distance,
                uv: intersection.uv
            };

            // Émettre l'événement
            EventBus.trigger(eventName, clickData);

            // Appeler le callback si fourni
            if (onClick && typeof onClick === 'function') {
                onClick(clickData);
            }
        };

        // Ajouter l'écouteur de clic
        if (objectRef.current && objectRef.current.uuid) {
            cleanupRef.current = addClickListener(objectRef.current.uuid, handleObjectClick);
        }

        // Nettoyage lors du démontage
        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }
        };
    }, [objectRef, enabled, eventName, addClickListener, onClick, debug, isGlobalListening]);

    return {
        isListening: isGlobalListening && isRayCasterListening && enabled,
        subscribe: (callback) => EventBus.on(eventName, callback)
    };
};

export default useSceneClick;