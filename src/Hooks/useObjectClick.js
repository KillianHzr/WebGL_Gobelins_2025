import {useEffect, useRef} from 'react';
import {useRayCaster} from '../Utils/RayCaster';
import useStore from '../Store/useStore';

/**
 * Hook personnalisé pour détecter les clics sur un objet 3D spécifique
 *
 * @param {Object} params - Paramètres du hook
 * @param {React.RefObject} params.objectRef - Référence à l'objet 3D
 * @param {Function} params.onClick - Fonction appelée lors d'un clic sur l'objet
 * @param {boolean} params.enabled - Activer/désactiver la détection (optionnel, true par défaut)
 * @param {boolean} params.debug - Activer les logs de débogage (optionnel, false par défaut)
 * @returns {Object} - État et méthodes
 */
export default function useObjectClick({
                                           objectRef, onClick, enabled = true, debug = false
                                       }) {
    const {addClickListener} = useRayCaster();
    const cleanupRef = useRef();
    const clickListener = useStore(state => state.clickListener);

    // Déterminer si l'écoute est active
    const isListening = clickListener?.isListening && enabled;

    useEffect(() => {
        // Ne rien faire si l'objet n'est pas défini, si l'écoute est désactivée,
        // ou si la référence n'a pas d'objet current
        if (!objectRef?.current || !enabled || !clickListener?.isListening) {
            console.log('[useObjectClick] Not listening:', {
                objectExists: !!objectRef?.current, enabled, isListening: clickListener?.isListening
            });
            return;
        }

        console.log('[useObjectClick] Registering click listener for object:', objectRef.current.name || objectRef.current.uuid);

        // Gérer le clic sur l'objet
        const handleClick = (intersection, event) => {
            console.log('[useObjectClick] Object clicked!');
            if (debug) {
                console.log('[useObjectClick] Objet cliqué:', {
                    name: objectRef.current.name || 'sans nom', uuid: objectRef.current.uuid, intersection
                });
            }

            // Appeler le callback avec l'information sur l'intersection
            if (onClick) {
                onClick(intersection, event);
            }
        };

        // Ajouter un écouteur de clic à l'objet
        cleanupRef.current = addClickListener(objectRef.current.uuid, handleClick);

        // Nettoyer lors du démontage ou lorsque les dépendances changent
        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }
        };
    }, [objectRef, onClick, enabled, addClickListener, clickListener?.isListening, debug]);

    // Méthodes exposées par le hook
    return {
        isListening
    };
}