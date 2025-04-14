// src/Utils/InteractiveMarkers/markerEvents.js

/**
 * Constantes pour les événements du système de marqueurs interactifs
 * Ces constantes permettent d'assurer la cohérence dans les noms d'événements
 * et facilitent le débogage.
 */
export const MARKER_EVENTS = {
    // Événements de base pour les marqueurs
    MARKER_CLICK: 'marker:click',
    MARKER_HOVER: 'marker:hover',
    MARKER_HOVER_END: 'marker:hover:end',
    MARKER_SHOW: 'marker:show',
    MARKER_HIDE: 'marker:hide',

    // Événements pour les groupes de marqueurs
    GROUP_VISIBILITY_CHANGED: 'marker:group:visibility',
    GROUP_FOCUS: 'marker:group:focus',

    // Événements d'animation de caméra
    CAMERA_ANIMATION_START: 'marker:camera:animation:start',
    CAMERA_ANIMATION_COMPLETE: 'marker:camera:animation:complete',
    CAMERA_ANIMATION_CANCEL: 'marker:camera:animation:cancel',

    // Événements d'interaction utilisateur
    INTERACTION_REQUIRED: 'marker:interaction:required',
    INTERACTION_COMPLETE: 'marker:interaction:complete',

    // Événements du système de configuration
    CONFIG_LOADED: 'marker:config:loaded',
    CONFIG_ERROR: 'marker:config:error',

    // Événements liés à la hiérarchie des marqueurs
    PARENT_MARKER_ACTIVATED: 'marker:parent:activated',
    CHILD_MARKER_ACTIVATED: 'marker:child:activated',

    // Événements personnalisés pour les intégrations spécifiques
    CUSTOM_ACTION: 'marker:custom:action'
};

/**
 * Utilitaire pour créer des événements personnalisés
 * @param {string} baseName - Nom de base de l'événement
 * @param {string} specificName - Nom spécifique à ajouter
 * @returns {string} - Chaîne d'événement formatée
 */
export const createCustomMarkerEvent = (baseName, specificName) => {
    return `marker:custom:${baseName}:${specificName}`;
};

export default MARKER_EVENTS;