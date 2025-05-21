import React, {createContext, forwardRef, useContext, useImperativeHandle, useState} from 'react';

// Activer ou désactiver les logs pour le débogage
const DEBUG_EVENTS = false;

// Helper pour les logs conditionnels
const debugLog = (message, ...args) => {
    if (DEBUG_EVENTS) console.log(`[EventEmitter] ${message}`, ...args);
};

// Singleton pour stocker l'instance de l'EventEmitter
// Initialisé immédiatement avec des méthodes de base pour éviter les "not initialized yet"
let emitterInstance = {
    on: (eventName, callback) => {
        debugLog('EventEmitter on() called before initialization, will be queued');
        queuedEvents.push({type: 'on', eventName, callback});
        return () => {
        };
    }, off: (eventName) => {
        debugLog('EventEmitter off() called before initialization, will be queued');
        queuedEvents.push({type: 'off', eventName});
    }, trigger: (eventName, data) => {
        debugLog('EventEmitter trigger() called before initialization, will be queued');
        queuedEvents.push({type: 'trigger', eventName, data});
    }
};

// File d'attente pour les événements appelés avant l'initialisation
const queuedEvents = [];

// Contexte React pour accéder à l'EventEmitter
const EventEmitterContext = createContext(null);

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


    INTERACTION_ANIMATION: 'marker:interaction:animation',

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

// EventEmitter composant
const EventEmitter = forwardRef((props, ref) => {
    const [callbacks, setCallbacks] = useState({base: {}});

    // Map pour tracer les écouteurs actifs à des fins de débogage
    const [activeListeners, setActiveListeners] = useState(new Map());

    const resolveNames = (_names) => {
        if (!_names) return [];

        let names = _names;
        names = names.replace(/[^a-zA-Z0-9 ,/.:-]/g, '');
        names = names.replace(/[,/]+/g, ' ');
        names = names.split(' ');

        return names;
    };

    const resolveName = (name) => {
        if (!name) return null;

        const newName = {};
        const parts = name.split('.');

        newName.original = name;
        newName.value = parts[0];
        newName.namespace = 'base'; // Base namespace

        // Specified namespace
        if (parts.length > 1 && parts[1] !== '') {
            newName.namespace = parts[1];
        }

        return newName;
    };

    const on = (_names, callback) => {
        // Errors
        if (typeof _names === 'undefined' || _names === '') {
            debugLog('wrong names');
            return false;
        }

        if (typeof callback === 'undefined') {
            debugLog('wrong callback');
            return false;
        }

        // Resolve names
        const names = resolveNames(_names);

        // Create a new callbacks object to avoid direct state mutation
        const newCallbacks = {...callbacks};

        // Track new active listeners
        const newActiveListeners = new Map(activeListeners);

        // Each name
        names.forEach((_name) => {
            // Resolve name
            const name = resolveName(_name);

            if (!name) {
                debugLog(`Invalid name in on(): ${_name}`);
                return;
            }

            // Create namespace if not exist
            if (!(newCallbacks[name.namespace] instanceof Object)) {
                newCallbacks[name.namespace] = {};
            }

            // Create callback if not exist
            if (!(newCallbacks[name.namespace][name.value] instanceof Array)) {
                newCallbacks[name.namespace][name.value] = [];
            }

            // Add callback
            newCallbacks[name.namespace][name.value].push(callback);

            // Track the listener (pour débogage)
            const listenerId = `${name.namespace}.${name.value}.${newCallbacks[name.namespace][name.value].length - 1}`;
            newActiveListeners.set(listenerId, {
                event: _name, addedAt: new Date().toISOString(), callbackName: callback.name || 'anonymous'
            });
        });

        setCallbacks(newCallbacks);
        setActiveListeners(newActiveListeners);

        // Retourner une fonction de nettoyage pour faciliter la désabonnement
        return () => {
            off(_names);
        };
    };

    const off = (_names) => {
        // Errors
        if (typeof _names === 'undefined' || _names === '') {
            debugLog('wrong name');
            return false;
        }

        // Resolve names
        const names = resolveNames(_names);

        if (names.length === 0) {
            debugLog(`No valid names to unsubscribe from: ${_names}`);
            return false;
        }

        // Create a new callbacks object to avoid direct state mutation
        const newCallbacks = {...callbacks};

        // Track removed listeners
        const newActiveListeners = new Map(activeListeners);

        // Each name
        names.forEach((_name) => {
            // Resolve name
            const name = resolveName(_name);

            if (!name) {
                debugLog(`Invalid name in off(): ${_name}`);
                return;
            }

            // Remove namespace
            if (name.namespace !== 'base' && name.value === '') {
                if (newCallbacks[name.namespace]) {
                    delete newCallbacks[name.namespace];

                    // Remove all listeners in this namespace from tracking
                    for (const [id, info] of newActiveListeners) {
                        if (id.startsWith(`${name.namespace}.`)) {
                            newActiveListeners.delete(id);
                        }
                    }
                }
            }

            // Remove specific callback in namespace
            else {
                // Default
                if (name.namespace === 'base') {
                    // Try to remove from each namespace
                    for (const namespace in newCallbacks) {
                        if (newCallbacks[namespace] instanceof Object && newCallbacks[namespace][name.value] instanceof Array) {
                            delete newCallbacks[namespace][name.value];

                            // Remove all listeners with this value from tracking
                            for (const [id, info] of newActiveListeners) {
                                if (id.startsWith(`${namespace}.${name.value}.`)) {
                                    newActiveListeners.delete(id);
                                }
                            }

                            // Remove namespace if empty
                            if (Object.keys(newCallbacks[namespace]).length === 0) {
                                delete newCallbacks[namespace];
                            }
                        }
                    }
                }

                // Specified namespace
                else if (newCallbacks[name.namespace] instanceof Object && newCallbacks[name.namespace][name.value] instanceof Array) {
                    delete newCallbacks[name.namespace][name.value];

                    // Remove all listeners with this namespace and value from tracking
                    for (const [id, info] of newActiveListeners) {
                        if (id.startsWith(`${name.namespace}.${name.value}.`)) {
                            newActiveListeners.delete(id);
                        }
                    }

                    // Remove namespace if empty
                    if (Object.keys(newCallbacks[name.namespace]).length === 0) {
                        delete newCallbacks[name.namespace];
                    }
                }
            }
        });

        setCallbacks(newCallbacks);
        setActiveListeners(newActiveListeners);
        return true;
    };

    const trigger = (_name, _args) => {
        // Errors
        if (typeof _name === 'undefined' || _name === '') {
            debugLog('wrong name');
            return false;
        }

        let finalResult = null;
        let result = null;

        // Default args
        const args = !(_args instanceof Array) ? [] : _args;

        // Resolve names (should on have one event)
        let name = resolveNames(_name);

        if (name.length === 0) {
            debugLog(`No valid name to trigger: ${_name}`);
            return false;
        }

        // Resolve name
        name = resolveName(name[0]);

        if (!name) {
            debugLog(`Invalid name in trigger(): ${_name}`);
            return false;
        }

        const callbacksCalled = [];

        // Default namespace
        if (name.namespace === 'base') {
            // Try to find callback in each namespace
            for (const namespace in callbacks) {
                if (callbacks[namespace] instanceof Object && callbacks[namespace][name.value] instanceof Array) {
                    callbacks[namespace][name.value].forEach((callback, index) => {
                        if (typeof callback !== 'function') {
                            debugLog(`Invalid callback for ${namespace}.${name.value}[${index}]`);
                            return;
                        }

                        try {
                            result = callback.apply(null, args);
                            callbacksCalled.push(`${namespace}.${name.value}.${index}`);

                            if (typeof finalResult === 'undefined') {
                                finalResult = result;
                            }
                        } catch (error) {
                            console.error(`Error in event handler for ${namespace}.${name.value}:`, error);
                        }
                    });
                }
            }
        }

        // Specified namespace
        else if (callbacks[name.namespace] instanceof Object) {
            if (name.value === '') {
                debugLog('wrong name');
                return null;
            }

            if (callbacks[name.namespace][name.value] instanceof Array) {
                callbacks[name.namespace][name.value].forEach((callback, index) => {
                    if (typeof callback !== 'function') {
                        debugLog(`Invalid callback for ${name.namespace}.${name.value}[${index}]`);
                        return;
                    }

                    try {
                        result = callback.apply(null, args);
                        callbacksCalled.push(`${name.namespace}.${name.value}.${index}`);

                        if (typeof finalResult === 'undefined') {
                            finalResult = result;
                        }
                    } catch (error) {
                        console.error(`Error in event handler for ${name.namespace}.${name.value}:`, error);
                    }
                });
            }
        }

        if (DEBUG_EVENTS) {
            if (callbacksCalled.length > 0) {
                debugLog(`Event '${_name}' triggered ${callbacksCalled.length} callbacks: ${callbacksCalled.join(', ')}`);
            } else {
                debugLog(`Event '${_name}' triggered but no callbacks were found`);
            }
        }
        if (_name.includes('marker:') || _name.includes('scenario:') || _name.includes('narration:')) {
            console.log(`%c${_name}`, 'background: #555; color: white; padding: 2px;',
                _args && _args.length > 0 ? _args[0] : '');
        }
        return finalResult;
    };

    // Exposer les méthodes via useImperativeHandle pour les rendre accessibles via ref
    useImperativeHandle(ref, () => {
        const methods = {
            on, off, trigger, // Méthode de débogage
            getActiveListeners: () => Array.from(activeListeners.entries())
        };

        // Stocker l'instance pour le singleton
        emitterInstance = methods;

        return methods;
    });

    // Le composant n'a pas besoin de rendre quoi que ce soit de visible
    return null;
});

/**
 * Fournisseur du contexte pour l'émetteur d'événements
 */
export const EventEmitterProvider = ({children}) => {
    const emitterRef = React.useRef(null);

    // Mémoiser les méthodes d'événements
    const emitterMethods = React.useMemo(() => ({
        on: (...args) => emitterRef.current?.on(...args),
        off: (...args) => emitterRef.current?.off(...args),
        trigger: (...args) => emitterRef.current?.trigger(...args),
        getActiveListeners: () => emitterRef.current?.getActiveListeners() || []
    }), []);

    return (<EventEmitterContext.Provider value={emitterMethods}>
        <EventEmitter ref={emitterRef}/>
        {children}
    </EventEmitterContext.Provider>);
};

/**
 * Hook pour utiliser l'émetteur d'événements
 */
export const useEventEmitter = () => {
    const context = useContext(EventEmitterContext);

    if (!context) {
        throw new Error('useEventEmitter must be used within an EventEmitterProvider');
    }

    return context;
};

/**
 * API simpifiée pour accéder à l'émetteur d'événements de manière globale
 */
export let EventBus = {
    /**
     * Émet un événement
     */
    trigger: (eventName, data) => {
        if (emitterInstance) {
            return emitterInstance.trigger(eventName, Array.isArray(data) ? data : [data]);
        } else {
            debugLog('EventEmitter not initialized yet');
            return null;
        }
    },

    /**
     * S'abonne à un événement
     */
    on: (eventName, callback) => {
        if (emitterInstance) {
            try {
                return emitterInstance.on(eventName, callback);
            } catch (error) {
                console.error(`Error subscribing to event ${eventName}:`, error);
                // Retourner une fonction vide pour éviter les erreurs
                return () => {
                };
            }
        } else {
            debugLog('EventEmitter not initialized yet');
            return () => {
            };
        }
    },

    /**
     * Se désabonne d'un événement
     */
    off: (eventName) => {
        if (emitterInstance) {
            try {
                return emitterInstance.off(eventName);
            } catch (error) {
                console.error(`Error unsubscribing from event ${eventName}:`, error);
                return false;
            }
        } else {
            debugLog('EventEmitter not initialized yet');
            return false;
        }
    },

    /**
     * Méthode pratique pour créer des événements personnalisés de marqueurs
     * @param {string} baseName - Nom de base de l'événement
     * @param {string} specificName - Nom spécifique à ajouter
     * @returns {string} - Chaîne d'événement formatée
     */
    createMarkerEvent: createCustomMarkerEvent,

    /**
     * Constantes pour les événements de marqueurs
     */
    MARKER: MARKER_EVENTS,

    /**
     * Méthode de débogage pour voir tous les écouteurs actifs
     */
    getActiveListeners: () => {
        if (emitterInstance && emitterInstance.getActiveListeners) {
            return emitterInstance.getActiveListeners();
        }
        return [];
    }
};

export default EventEmitter;