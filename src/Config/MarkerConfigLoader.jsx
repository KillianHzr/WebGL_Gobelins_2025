import React, { useState, useEffect } from 'react';
import { EventBus } from '../Utils/EventEmitter';
import { MARKER_EVENTS } from '../Utils/MarkerSystem.jsx';

/**
 * Composant pour charger une configuration de marqueurs depuis un fichier JSON
 * @param {Object} props - Propriétés du composant
 * @param {string} props.configUrl - URL du fichier de configuration JSON (optionnel)
 * @param {Object} props.configObject - Objet de configuration directement (optionnel)
 * @param {Function} props.onConfigLoaded - Callback appelé quand la configuration est chargée
 * @param {Function} props.onError - Callback appelé en cas d'erreur
 */
export const MarkerConfigLoader = ({
                                       configUrl,
                                       configObject,
                                       onConfigLoaded,
                                       onError
                                   }) => {
    const [config, setConfig] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Validation du schéma de configuration
    const validateConfig = (configData) => {
        // Vérifier les champs obligatoires
        if (!configData.markers || !Array.isArray(configData.markers)) {
            throw new Error('Invalid config: markers array is required');
        }

        if (!configData.groups || !Array.isArray(configData.groups)) {
            throw new Error('Invalid config: groups array is required');
        }

        // Vérifier que chaque marqueur a un id
        const markerIds = new Set();
        for (const marker of configData.markers) {
            if (!marker.id) {
                throw new Error('Invalid config: every marker must have an id');
            }

            if (markerIds.has(marker.id)) {
                throw new Error(`Invalid config: duplicate marker id '${marker.id}'`);
            }

            markerIds.add(marker.id);
        }

        // Vérifier que chaque groupe a un id
        const groupIds = new Set();
        for (const group of configData.groups) {
            if (!group.id) {
                throw new Error('Invalid config: every group must have an id');
            }

            if (groupIds.has(group.id)) {
                throw new Error(`Invalid config: duplicate group id '${group.id}'`);
            }

            groupIds.add(group.id);
        }

        // Vérifier que les relations parent-enfant sont valides
        for (const marker of configData.markers) {
            if (marker.parent && !markerIds.has(marker.parent)) {
                throw new Error(`Invalid config: marker '${marker.id}' has invalid parent '${marker.parent}'`);
            }

            if (marker.children) {
                for (const childId of marker.children) {
                    if (!markerIds.has(childId)) {
                        throw new Error(`Invalid config: marker '${marker.id}' has invalid child '${childId}'`);
                    }
                }
            }
        }

        // Vérifier que les groupes référencés existent
        for (const marker of configData.markers) {
            if (marker.groupId && !groupIds.has(marker.groupId)) {
                throw new Error(`Invalid config: marker '${marker.id}' has invalid group '${marker.groupId}'`);
            }
        }

        return true;
    };

    // Charger la configuration depuis l'URL
    const loadConfigFromUrl = async (url) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to load marker config: ${response.status} ${response.statusText}`);
            }

            const configData = await response.json();

            // Valider la configuration
            validateConfig(configData);

            setConfig(configData);

            // Appeler le callback et émettre l'événement
            if (onConfigLoaded) {
                onConfigLoaded(configData);
            }

            EventBus.trigger(MARKER_EVENTS.CONFIG_LOADED, { config: configData });

            return configData;
        } catch (err) {
            const errorMessage = `Error loading marker config: ${err.message}`;
            setError(errorMessage);

            if (onError) {
                onError(errorMessage);
            }

            EventBus.trigger(MARKER_EVENTS.CONFIG_ERROR, { error: errorMessage });

            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // Effet pour charger la configuration au montage du composant
    useEffect(() => {
        if (configObject) {
            // Utiliser l'objet de configuration fourni directement
            try {
                validateConfig(configObject);
                setConfig(configObject);

                if (onConfigLoaded) {
                    onConfigLoaded(configObject);
                }

                EventBus.trigger(MARKER_EVENTS.CONFIG_LOADED, { config: configObject });
            } catch (err) {
                const errorMessage = `Error in marker config: ${err.message}`;
                setError(errorMessage);

                if (onError) {
                    onError(errorMessage);
                }

                EventBus.trigger(MARKER_EVENTS.CONFIG_ERROR, { error: errorMessage });
            }
        } else if (configUrl) {
            // Charger depuis l'URL
            loadConfigFromUrl(configUrl);
        }
    }, [configUrl, configObject]);

    // Ce composant ne rend rien visuellement
    return null;
};

/**
 * Exemple de structure de configuration de marqueurs
 * Peut être utilisé comme guide pour créer des configurations
 */
export const EXAMPLE_MARKER_CONFIG = {
    // Groupes de marqueurs (pour organiser et contrôler la visibilité)
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

    // Configuration des marqueurs individuels
    markers: [
        {
            id: 'marker-1',
            title: 'Point principal 1',
            description: 'Description du premier point d\'intérêt',
            position: { x: 2, y: 1.5, z: -3 },
            ctaType: 'info',
            icon: 'info-circle',
            color: '#00aaff',
            scale: 1.2,
            groupId: 'main-points',
            targetView: {
                position: { x: 1, y: 1, z: -2 },
                lookAt: { x: 2, y: 1.5, z: -3 }
            }
        },
        {
            id: 'marker-2',
            title: 'Point secondaire',
            description: 'Point d\'information complémentaire',
            position: { x: -3, y: 0.5, z: 2 },
            ctaType: 'hotspot',
            icon: 'pin',
            color: '#ff6600',
            scale: 1,
            groupId: 'secondary-points',
            // Relation hiérarchique avec le marqueur principal
            parent: 'marker-1'
        },
        {
            id: 'marker-3',
            title: 'Point d\'interaction',
            description: 'Une action est requise ici',
            position: { x: 0, y: 1, z: 4 },
            ctaType: 'interaction',
            icon: 'hand-pointer',
            color: '#44ff44',
            scale: 1.5,
            groupId: 'main-points',
            // Événements personnalisés
            onClick: 'marker:custom:interaction',
            onHover: 'marker:custom:preview',
            // Données personnalisées pour les callbacks
            customData: {
                actionType: 'toggle',
                targetId: 'some-object'
            }
        }
    ]
};

export default MarkerConfigLoader;