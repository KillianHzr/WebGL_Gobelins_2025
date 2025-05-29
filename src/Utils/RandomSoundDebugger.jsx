import React, { useEffect, useState } from 'react';
import useStore from '../Store/useStore';

/**
 * Composant de débogage pour visualiser l'état des sons aléatoires
 * S'affiche uniquement en mode debug
 */
const RandomSoundDebugger = () => {
    const { debug } = useStore();
    const [soundsState, setSoundsState] = useState({});
    const [visible, setVisible] = useState(false);
    const [systemActive, setSystemActive] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editValues, setEditValues] = useState({});
    const [editStatus, setEditStatus] = useState({ message: '', type: '' });

    // Surveiller l'état du mode debug pour afficher/masquer le débogueur
    useEffect(() => {
        if (debug?.active) {
            setVisible(true);
        } else {
            setVisible(false);
        }
    }, [debug]);

    // Mettre à jour l'état des sons toutes les 100ms pour une animation fluide
    useEffect(() => {
        if (!visible) return;

        // Récupérer l'état des sons aléatoires
        const updateSoundsState = () => {
            if (!window.audioManager?.randomAmbientSounds) return;

            const randomAmbientSounds = window.audioManager.randomAmbientSounds;
            setSystemActive(randomAmbientSounds.active);

            // Si le panel est réduit, on ne fait pas de calculs inutiles
            if (collapsed) return;

            const newState = {};

            // Pour chaque son configuré
            Object.keys(randomAmbientSounds.config).forEach(soundId => {
                const config = randomAmbientSounds.config[soundId];
                const howl = randomAmbientSounds.howls[soundId];

                // Vérifier si le son est en cours de lecture
                let isPlaying = false;
                let currentVolume = 'N/A';

                // Gérer les sons avec multiples variants
                if (Array.isArray(howl)) {
                    isPlaying = howl.some(h => h.playing());
                    const playingHowl = howl.find(h => h.playing());
                    currentVolume = playingHowl ? playingHowl.volume().toFixed(2) : 'N/A';
                } else if (howl) {
                    isPlaying = howl.playing();
                    currentVolume = isPlaying ? howl.volume().toFixed(2) : 'N/A';
                }

                // Obtenir le temps de lecture restant si le son est en cours
                let playbackInfo = null;
                if (isPlaying) {
                    // Obtenir les infos de lecture depuis le système
                    const remainingMs = randomAmbientSounds.getPlaybackRemainingTime(soundId) || 0;
                    const progress = randomAmbientSounds.getPlaybackProgress(soundId) || 0;
                    const totalDuration = randomAmbientSounds.soundDurations[soundId] || 0;

                    playbackInfo = {
                        remainingMs,
                        progress: 100 - progress, // Inversion pour que la barre diminue
                        remainingText: `${(remainingMs / 1000).toFixed(1)}s`,
                        totalDuration
                    };
                }

                // Obtenir le temps restant avant la prochaine lecture
                let nextPlayIn = 'N/A';
                let remainingMs = 0;

                if (!isPlaying && randomAmbientSounds.nextPlayTimes && randomAmbientSounds.nextPlayTimes[soundId]) {
                    remainingMs = Math.max(0, randomAmbientSounds.nextPlayTimes[soundId] - Date.now());
                    nextPlayIn = remainingMs > 0 ? `${(remainingMs / 1000).toFixed(1)}s` : 'Imminent';
                } else if (!randomAmbientSounds.active) {
                    nextPlayIn = 'Inactif';
                }

                // Stocker l'état du son
                newState[soundId] = {
                    isPlaying,
                    nextPlayIn,
                    remainingMs,
                    playbackInfo,
                    currentVolume,
                    config: {
                        minInterval: config.minInterval,
                        maxInterval: config.maxInterval,
                        minVolume: config.minVolume,
                        maxVolume: config.maxVolume,
                        // Indiquer s'il s'agit d'un son avec variants multiples
                        hasVariants: Array.isArray(config.paths)
                    }
                };
            });

            setSoundsState(newState);

            // Initialiser les valeurs d'édition si elles sont vides
            if (editMode && Object.keys(editValues).length === 0) {
                const initialEditValues = {};
                Object.keys(newState).forEach(soundId => {
                    initialEditValues[soundId] = {
                        minInterval: newState[soundId].config.minInterval,
                        maxInterval: newState[soundId].config.maxInterval,
                        minVolume: newState[soundId].config.minVolume,
                        maxVolume: newState[soundId].config.maxVolume
                    };
                });
                setEditValues(initialEditValues);
            }
        };

        // Mettre à jour immédiatement puis toutes les 100ms pour une animation fluide
        updateSoundsState();
        const interval = setInterval(updateSoundsState, 100);

        return () => {
            clearInterval(interval);
        };
    }, [visible, collapsed, editMode, editValues.length]);

    // Toggle état réduit/déplié
    const toggleCollapsed = () => {
        setCollapsed(!collapsed);
        if (editMode) {
            setEditMode(false);
        }
    };

    // Toggle mode édition
    const toggleEditMode = () => {
        if (collapsed) return;

        if (!editMode) {
            // Entrer en mode édition
            const initialEditValues = {};
            Object.keys(soundsState).forEach(soundId => {
                initialEditValues[soundId] = {
                    minInterval: soundsState[soundId].config.minInterval,
                    maxInterval: soundsState[soundId].config.maxInterval,
                    minVolume: soundsState[soundId].config.minVolume,
                    maxVolume: soundsState[soundId].config.maxVolume
                };
            });
            setEditValues(initialEditValues);
            setEditMode(true);
        } else {
            // Sortir du mode édition
            setEditMode(false);
            setEditStatus({ message: '', type: '' });
        }
    };

    // Mettre à jour une valeur d'édition
    const handleEditChange = (soundId, param, value) => {
        // S'assurer que la valeur est un nombre
        let numValue = parseFloat(value);

        if (isNaN(numValue)) {
            numValue = 0;
        }

        // Copier les valeurs actuelles
        const newEditValues = { ...editValues };

        // Mettre à jour la valeur
        newEditValues[soundId] = {
            ...newEditValues[soundId],
            [param]: numValue
        };

        // S'assurer que min <= max
        if (param === 'minInterval' && numValue > newEditValues[soundId].maxInterval) {
            newEditValues[soundId].maxInterval = numValue;
        } else if (param === 'maxInterval' && numValue < newEditValues[soundId].minInterval) {
            newEditValues[soundId].minInterval = numValue;
        } else if (param === 'minVolume' && numValue > newEditValues[soundId].maxVolume) {
            newEditValues[soundId].maxVolume = numValue;
        } else if (param === 'maxVolume' && numValue < newEditValues[soundId].minVolume) {
            newEditValues[soundId].minVolume = numValue;
        }

        setEditValues(newEditValues);
    };

    // Appliquer les modifications
    const applyChanges = () => {
        if (!window.audioManager?.randomAmbientSounds) {
            setEditStatus({
                message: 'Système non disponible',
                type: 'error'
            });
            return;
        }

        try {
            // Appliquer les modifications pour chaque son
            Object.keys(editValues).forEach(soundId => {
                window.updateRandomSoundConfig(soundId, editValues[soundId]);
            });

            setEditStatus({
                message: 'Modifications appliquées',
                type: 'success'
            });

            // Effacer le message après 3 secondes
            setTimeout(() => {
                setEditStatus({ message: '', type: '' });
            }, 3000);
        } catch (error) {
            console.error('Erreur lors de l\'application des modifications:', error);
            setEditStatus({
                message: 'Erreur: ' + error.message,
                type: 'error'
            });
        }
    };

    // Jouer un son manuellement
    const playSoundManually = (soundId) => {
        if (!window.audioManager?.randomAmbientSounds?.howls?.[soundId]) return;

        const sound = window.audioManager.randomAmbientSounds;
        const config = sound.config[soundId];
        const howl = sound.howls[soundId];
        const volume = (config.minVolume + config.maxVolume) / 2;

        // Gérer les sons avec multiples variants
        if (Array.isArray(howl)) {
            const variantIndex = sound.selectRandomVariant(soundId);
            const selectedHowl = howl[variantIndex];
            selectedHowl.volume(volume);
            selectedHowl.play();

            // Log pour le débogage
            if (config.paths) {
                const pathInfo = config.paths[variantIndex];
                console.log(`Manual play: ${soundId} variant ${variantIndex} (${pathInfo.path}) (probability: ${(pathInfo.probability * 100).toFixed(1)}%)`);
            }
        } else {
            // Son classique
            howl.volume(volume);
            howl.play();
            console.log(`Manual play: ${soundId}`);
        }
    };

    // Ne rien afficher si le débogueur n'est pas visible
    if (!visible) return null;

    return (
        <div className={`random-sound-debugger ${collapsed ? 'collapsed' : ''} ${editMode ? 'edit-mode' : ''}`}>
            <div className="sound-debugger-header">
                <div className="header-main">
                    <h3>Sons aléatoires</h3>
                    <div className={`system-status ${systemActive ? 'active' : 'inactive'}`}>
                        {systemActive ? 'Actif' : 'Inactif'}
                    </div>
                </div>
                <div className="controls">
                    {!collapsed && (
                        <button
                            className={`edit-btn ${editMode ? 'active' : ''}`}
                            onClick={toggleEditMode}
                            title={editMode ? "Quitter le mode édition" : "Modifier les paramètres"}
                        >
                            ✎
                        </button>
                    )}
                    <button
                        className="collapse-btn"
                        onClick={toggleCollapsed}
                        title={collapsed ? "Développer" : "Réduire"}
                    >
                        {collapsed ? '▼' : '▲'}
                    </button>
                </div>
            </div>

            {!collapsed && (
                <div className="sound-list-container">
                    {editMode && editStatus.message && (
                        <div className={`edit-status ${editStatus.type}`}>
                            {editStatus.message}
                        </div>
                    )}

                    {editMode && (
                        <div className="edit-controls">
                            <button className="apply-btn" onClick={applyChanges}>
                                Appliquer les modifications
                            </button>
                        </div>
                    )}

                    <div className="sound-list">
                        {Object.keys(soundsState).map(soundId => {
                            const sound = soundsState[soundId];
                            const editValue = editValues[soundId] || sound.config;

                            // Calculer la barre de progression
                            let progressPercent = 0;
                            let progressLabel = '';

                            if (sound.isPlaying && sound.playbackInfo) {
                                // Quand le son joue, afficher le temps restant de lecture
                                progressPercent = sound.playbackInfo.progress;
                                progressLabel = sound.playbackInfo.remainingText;
                            } else if (sound.remainingMs > 0) {
                                // Quand le son est en attente, afficher le temps avant la prochaine lecture
                                // Estimer un total à partir de l'intervalle moyen
                                const totalTime = (sound.config.minInterval + sound.config.maxInterval) * 500; // Moyenne en ms
                                const elapsed = totalTime - sound.remainingMs;
                                progressPercent = Math.min(100, Math.max(0, (elapsed / totalTime) * 100));
                                progressLabel = sound.nextPlayIn;
                            }

                            return (
                                <div key={soundId} className={`sound-item ${sound.isPlaying ? 'playing' : ''}`}>
                                    <div className="sound-header">
                                        <span className="sound-name">
                                            {soundId}
                                            {sound.config.hasVariants && <span className="variant-indicator" title="Son avec variants multiples">🎲</span>}
                                        </span>
                                        <div className="sound-actions">
                                            <button
                                                className="play-btn"
                                                onClick={() => playSoundManually(soundId)}
                                                title="Jouer ce son manuellement"
                                            >
                                                ▶
                                            </button>
                                            <span className={`sound-status ${sound.isPlaying ? 'active' : ''}`}>
                                                {sound.isPlaying ? '▶ Lecture' : '■ Arrêté'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="progress-container">
                                        <div className="progress-bar-container">
                                            <div
                                                className={`progress-bar ${sound.isPlaying ? 'playing' : ''}`}
                                                style={{width: `${progressPercent}%`}}
                                            />
                                        </div>
                                    </div>

                                    <div className="sound-details">
                                        <div className="sound-timing">
                                            <span className="sound-label">
                                                {sound.isPlaying ? 'Reste:' : 'Prochain:'}
                                            </span>
                                            <span className="sound-value">
                                                {sound.isPlaying
                                                    ? (sound.playbackInfo ? sound.playbackInfo.remainingText : 'N/A')
                                                    : sound.nextPlayIn}
                                            </span>
                                        </div>
                                        <div className="sound-volume">
                                            <span className="sound-label">Volume :</span>
                                            <span className="sound-value">{sound.currentVolume}</span>
                                        </div>

                                        {!editMode ? (
                                            <div className="sound-config">
                                                <div className="sound-intervals">
                                                    <span className="sound-label">Interval :</span>
                                                    <span className="sound-value">
                                                        {sound.config.minInterval}s - {sound.config.maxInterval}s
                                                    </span>
                                                </div>
                                                <div className="sound-volumes">
                                                    <span className="sound-label">Volume :</span>
                                                    <span className="sound-value">
                                                        {sound.config.minVolume.toFixed(2)} - {sound.config.maxVolume.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="sound-config edit">
                                                <div className="edit-row">
                                                    <label>Interval min (s):</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="120"
                                                        step="1"
                                                        value={editValue.minInterval}
                                                        onChange={(e) => handleEditChange(soundId, 'minInterval', e.target.value)}
                                                    />
                                                </div>
                                                <div className="edit-row">
                                                    <label>Interval max (s):</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="120"
                                                        step="1"
                                                        value={editValue.maxInterval}
                                                        onChange={(e) => handleEditChange(soundId, 'maxInterval', e.target.value)}
                                                    />
                                                </div>
                                                <div className="edit-row">
                                                    <label>Volume min:</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="1"
                                                        step="0.05"
                                                        value={editValue.minVolume}
                                                        onChange={(e) => handleEditChange(soundId, 'minVolume', e.target.value)}
                                                    />
                                                </div>
                                                <div className="edit-row">
                                                    <label>Volume max:</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="1"
                                                        step="0.05"
                                                        value={editValue.maxVolume}
                                                        onChange={(e) => handleEditChange(soundId, 'maxVolume', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <style jsx="true">{`
                .random-sound-debugger {
                    position: fixed;
                    top: 10px;
                    left: 10px;
                    z-index: 1000;
                    background-color: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 10px;
                    border-radius: 5px;
                    font-family: monospace;
                    font-size: 12px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
                    transition: all 0.3s ease;
                }
                
                .random-sound-debugger.collapsed {
                    width: auto;
                }
                
                .random-sound-debugger.edit-mode {
                    border: 1px solid #4CAF50;
                }

                .sound-debugger-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 5px;
                }
                
                .header-main {
                    display: flex;
                    flex-grow: 1;
                    justify-content: space-between;
                    align-items: center;
                    margin-right: 10px;
                }
                
                .controls {
                    display: flex;
                    gap: 5px;
                }
                
                .collapsed .sound-debugger-header {
                    border-bottom: none;
                    margin-bottom: 0;
                    padding-bottom: 0;
                }
                
                .sound-debugger-header:not(.collapsed) {
                    border-bottom: 1px solid #4CAF50;
                    margin-bottom: 8px;
                }

                h3 {
                    margin: 0;
                    color: #4CAF50;
                }

                .system-status {
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 8px;
                    background-color: #555;
                    color: #ccc;
                }

                .system-status.active {
                    background-color: #4CAF50;
                    color: white;
                }
                
                .collapse-btn, .edit-btn, .play-btn {
                    background: none;
                    border: none;
                    color: #4CAF50;
                    font-size: 12px;
                    cursor: pointer;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    border-radius: 3px;
                    transition: background 0.2s;
                }
                
                .collapse-btn:hover, .edit-btn:hover, .play-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                
                .edit-btn.active {
                    background-color: #4CAF50;
                    color: white;
                }
                
                .edit-controls {
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: center;
                }
                
                .apply-btn {
                    background: #4CAF50;
                    border: none;
                    color: white;
                    padding: 3px 10px;
                    font-size: 11px;
                    border-radius: 3px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                
                .apply-btn:hover {
                    background: #3d8b40;
                }
                
                .edit-status {
                    text-align: center;
                    margin-bottom: 8px;
                    padding: 3px;
                    border-radius: 3px;
                    font-size: 11px;
                }
                
                .edit-status.success {
                    background-color: rgba(76, 175, 80, 0.3);
                    color: #8effb9;
                }
                
                .edit-status.error {
                    background-color: rgba(244, 67, 54, 0.3);
                    color: #ff8e8e;
                }

                .sound-list-container {
                    display: flex;
                    flex-direction: column;
                }
                
                .sound-list {
                    display: flex;
                    flex-direction: row;
                    gap: 8px;
                }

                .sound-item {
                    background-color: rgba(30, 30, 30, 0.7);
                    border-radius: 4px;
                    padding: 6px;
                    border-left: 3px solid #555;
                    position: relative;
                }

                .sound-item.playing {
                    border-left-color: #4CAF50;
                    background-color: rgba(40, 60, 40, 0.7);
                }

                .sound-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 3px;
                }
                
                .sound-actions {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                .sound-name {
                    font-weight: bold;
                    color: #BBB;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .variant-indicator {
                    font-size: 10px;
                    opacity: 0.7;
                }

                .sound-status {
                    font-size: 11px;
                    color: #888;
                }

                .sound-status.active {
                    color: #4CAF50;
                }

                .progress-container {
                    position: relative;
                    margin: 5px 0;
                }

                .progress-bar-container {
                    height: 4px;
                    background-color: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                    overflow: hidden;
                }

                .progress-bar {
                    height: 100%;
                    background-color: #888;
                    transition: width 0.1s linear;
                }

                .progress-bar.playing {
                    background-color: #4CAF50;
                }

                .progress-label {
                    position: absolute;
                    right: 0;
                    top: -14px;
                    font-size: 10px;
                    color: #4CAF50;
                    font-weight: bold;
                }

                .sound-details {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    margin-top: 2px;
                }

                .sound-timing, .sound-volume, .sound-intervals, .sound-volumes {
                    display: flex;
                    justify-content: space-between;
                }

                .sound-label {
                    color: #888;
                }

                .sound-value {
                    text-align: right;
                }

                .sound-config {
                    margin-top: 3px;
                    padding-top: 3px;
                    border-top: 1px dashed rgba(255, 255, 255, 0.1);
                }
                
                .sound-config.edit {
                    padding-top: 5px;
                }
                
                .edit-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 3px;
                }
                
                .edit-row label {
                    color: #888;
                    font-size: 11px;
                    margin-right: 5px;
                }
                
                .edit-row input {
                    background-color: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: white;
                    padding: 2px 4px;
                    border-radius: 2px;
                    font-size: 10px;
                    width: 50px;
                    text-align: right;
                }
                
                .edit-row input:focus {
                    outline: none;
                    border-color: #4CAF50;
                }
            `}</style>
        </div>
    );
};

export default RandomSoundDebugger;