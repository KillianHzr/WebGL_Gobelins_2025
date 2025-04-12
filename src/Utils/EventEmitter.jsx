import React, { useState, useEffect, useImperativeHandle, forwardRef, createContext, useContext } from 'react';

// Singleton pour stocker l'instance de l'EventEmitter
let emitterInstance = null;

// Contexte React pour accéder à l'EventEmitter
const EventEmitterContext = createContext(null);

// EventEmitter composant
const EventEmitter = forwardRef((props, ref) => {
    const [callbacks, setCallbacks] = useState({ base: {} });

    const resolveNames = (_names) => {
        let names = _names;
        names = names.replace(/[^a-zA-Z0-9 ,/.]/g, '');
        names = names.replace(/[,/]+/g, ' ');
        names = names.split(' ');

        return names;
    };

    const resolveName = (name) => {
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
            console.warn('wrong names');
            return false;
        }

        if (typeof callback === 'undefined') {
            console.warn('wrong callback');
            return false;
        }

        // Resolve names
        const names = resolveNames(_names);

        // Create a new callbacks object to avoid direct state mutation
        const newCallbacks = { ...callbacks };

        // Each name
        names.forEach((_name) => {
            // Resolve name
            const name = resolveName(_name);

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
        });

        setCallbacks(newCallbacks);
        return true;
    };

    const off = (_names) => {
        // Errors
        if (typeof _names === 'undefined' || _names === '') {
            console.warn('wrong name');
            return false;
        }

        // Resolve names
        const names = resolveNames(_names);

        // Create a new callbacks object to avoid direct state mutation
        const newCallbacks = { ...callbacks };

        // Each name
        names.forEach((_name) => {
            // Resolve name
            const name = resolveName(_name);

            // Remove namespace
            if (name.namespace !== 'base' && name.value === '') {
                delete newCallbacks[name.namespace];
            }

            // Remove specific callback in namespace
            else {
                // Default
                if (name.namespace === 'base') {
                    // Try to remove from each namespace
                    for (const namespace in newCallbacks) {
                        if (
                            newCallbacks[namespace] instanceof Object &&
                            newCallbacks[namespace][name.value] instanceof Array
                        ) {
                            delete newCallbacks[namespace][name.value];

                            // Remove namespace if empty
                            if (Object.keys(newCallbacks[namespace]).length === 0) {
                                delete newCallbacks[namespace];
                            }
                        }
                    }
                }

                // Specified namespace
                else if (
                    newCallbacks[name.namespace] instanceof Object &&
                    newCallbacks[name.namespace][name.value] instanceof Array
                ) {
                    delete newCallbacks[name.namespace][name.value];

                    // Remove namespace if empty
                    if (Object.keys(newCallbacks[name.namespace]).length === 0) {
                        delete newCallbacks[name.namespace];
                    }
                }
            }
        });

        setCallbacks(newCallbacks);
        return true;
    };

    const trigger = (_name, _args) => {
        // Errors
        if (typeof _name === 'undefined' || _name === '') {
            console.warn('wrong name');
            return false;
        }

        let finalResult = null;
        let result = null;

        // Default args
        const args = !(_args instanceof Array) ? [] : _args;

        // Resolve names (should on have one event)
        let name = resolveNames(_name);

        // Resolve name
        name = resolveName(name[0]);

        // Default namespace
        if (name.namespace === 'base') {
            // Try to find callback in each namespace
            for (const namespace in callbacks) {
                if (
                    callbacks[namespace] instanceof Object &&
                    callbacks[namespace][name.value] instanceof Array
                ) {
                    callbacks[namespace][name.value].forEach((callback) => {
                        result = callback.apply(null, args);

                        if (typeof finalResult === 'undefined') {
                            finalResult = result;
                        }
                    });
                }
            }
        }

        // Specified namespace
        else if (callbacks[name.namespace] instanceof Object) {
            if (name.value === '') {
                console.warn('wrong name');
                return null;
            }

            callbacks[name.namespace][name.value].forEach((callback) => {
                result = callback.apply(null, args);

                if (typeof finalResult === 'undefined') {
                    finalResult = result;
                }
            });
        }

        return finalResult;
    };

    // Exposer les méthodes via useImperativeHandle pour les rendre accessibles via ref
    useImperativeHandle(ref, () => {
        const methods = {
            on,
            off,
            trigger
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
export const EventEmitterProvider = ({ children }) => {
    const emitterRef = React.useRef(null);

    // Mémoiser les méthodes d'événements
    const emitterMethods = React.useMemo(() => ({
        on: (...args) => emitterRef.current?.on(...args),
        off: (...args) => emitterRef.current?.off(...args),
        trigger: (...args) => emitterRef.current?.trigger(...args)
    }), []);

    return (
        <EventEmitterContext.Provider value={emitterMethods}>
            <EventEmitter ref={emitterRef} />
            {children}
        </EventEmitterContext.Provider>
    );
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
export const EventBus = {
    /**
     * Émet un événement
     */
    trigger: (eventName, data) => {
        if (emitterInstance) {
            emitterInstance.trigger(eventName, Array.isArray(data) ? data : [data]);
        } else {
            console.warn('EventEmitter not initialized yet');
        }
    },

    /**
     * S'abonne à un événement
     */
    on: (eventName, callback) => {
        if (emitterInstance) {
            emitterInstance.on(eventName, callback);
            return () => emitterInstance.off(eventName);
        } else {
            console.warn('EventEmitter not initialized yet');
            return () => {};
        }
    },

    /**
     * Se désabonne d'un événement
     */
    off: (eventName) => {
        if (emitterInstance) {
            emitterInstance.off(eventName);
        } else {
            console.warn('EventEmitter not initialized yet');
        }
    }
};

export default EventEmitter;