import React, { useEffect, useState } from 'react';
import useStore from '../Store/useStore';

/**
 * Composant de débogage pour visualiser l'état des sons aléatoires
 * S'affiche uniquement en mode debug
 * Version avec support des phases nature/digital
 */
const RandomSoundDebugger = () => {
    const { debug } = useStore();
    const [soundsState, setSoundsState] = useState({});
    const [phaseInfo, setPhaseInfo] = useState({});
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

            const debugState = randomAmbientSounds.getDebugState();

            // Séparer les infos de phase des sons
            const { _phaseInfo, ...soundsOnly } = debugState;
            setPhaseInfo(_phaseInfo || {});

            const newState = {};

            // Pour chaque son configuré
            Object.keys(soundsOnly).forEach(soundId => {
                const sound = soundsOnly[soundId];
                const config = sound.config;

                // Vérifier si le son est en cours de lecture
                let isPlaying = sound.isPlaying;
                let currentVolume = isPlaying ? sound.currentVolume.toFixed(2) : 'N/A';

                // Obtenir le temps de lecture restant si le son est en cours
                let playbackInfo = null;
                if (isPlaying && sound.playbackRemaining !== null && sound.playbackProgress !== null) {
                    const remainingMs = sound.playbackRemaining;
                    const progress = 100 - sound.playbackProgress; // Inversion pour que la barre diminue

                    playbackInfo = {
                        remainingMs,
                        progress,
                        remainingText: `${(remainingMs / 1000).toFixed(1)}s`,
                        totalDuration: sound.duration
                    };
                }

                // Obtenir le temps restant avant la prochaine lecture
                let nextPlayIn = 'N/A';
                let remainingMs = 0;

                if (!isPlaying && sound.remainingTime !== null) {
                    remainingMs = sound.remainingTime;
                    nextPlayIn = remainingMs > 0 ? `${(remainingMs / 1000).toFixed(1)}s` : 'Imminent';
                } else if (!randomAmbientSounds.active) {
                    nextPlayIn = 'Inactif';
                } else if (!sound.isActiveInCurrentPhase) {
                    nextPlayIn = 'Phase inactive';
                }

                // Stocker l'état du son
                newState[soundId] = {
                    isPlaying,
                    nextPlayIn,
                    remainingMs,
                    playbackInfo,
                    currentVolume,
                    soundType: sound.soundType,
                    isActiveInCurrentPhase: sound.isActiveInCurrentPhase,
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
        const config = soundsState[soundId]?.config;
        if (!config) return;

        const howl = sound.howls[soundId];
        const volume = (config.minVolume + config.maxVolume) / 2;

        // Gérer les sons avec multiples variants
        if (Array.isArray(howl)) {
            const variantIndex = sound.selectRandomVariant(soundId);
            const selectedHowl = howl[variantIndex];
            selectedHowl.volume(volume);
            selectedHowl.play();

            console.log(`Manual play: ${soundId} variant ${variantIndex}`);
        } else {
            // Son classique
            howl.volume(volume);
            howl.play();
            console.log(`Manual play: ${soundId}`);
        }
    };

    // Forcer la transition de phase
    const forcePhaseTransition = (phase) => {
        if (!window.audioManager?.randomAmbientSounds) return;

        window.audioManager.randomAmbientSounds.forcePhaseTransition(phase);
        console.log(`Force transition to ${phase} phase`);
    };

    // Séparer les sons par type
    const natureSounds = Object.keys(soundsState).filter(soundId => soundsState[soundId].soundType === 'nature');
    const digitalSounds = Object.keys(soundsState).filter(soundId => soundsState[soundId].soundType === 'digital');

    // Ne rien afficher si le débogueur n'est pas visible
    if (!visible) return null;

    return (
        <div className={`random-sound-debugger ${collapsed ? 'collapsed' : ''} ${editMode ? 'edit-mode' : ''}`}>
            <div className="sound-debugger-header">
                <div className="header-main">
                    <div className="title-section">
                        <h3>Sons aléatoires</h3>
                        {/* Affichage de la phase actuelle */}
                        <div className="phase-info">
                            <span className={`phase-indicator ${phaseInfo.currentPhase || 'nature'}`}>
                                {phaseInfo.currentPhase === 'digital' ? '🔌 Digital' : '🌿 Nature'}
                            </span>
                            {phaseInfo.phaseTransitionProgress !== undefined && (
                                <span className="progress-text">
                                    {(phaseInfo.phaseTransitionProgress * 100).toFixed(1)}%
                                </span>
                            )}
                        </div>
                    </div>
                    <div className={`system-status ${systemActive ? 'active' : 'inactive'}`}>
                        {systemActive ? 'Actif' : 'Inactif'}
                    </div>
                </div>
                <div className="controls">
                    {!collapsed && (
                        <>
                            {/* Boutons de transition de phase */}
                            <button
                                className={`phase-btn ${phaseInfo.currentPhase === 'nature' ? 'active' : ''}`}
                                onClick={() => forcePhaseTransition('nature')}
                                title="Forcer la phase nature"
                            >
                                🌿
                            </button>
                            <button
                                className={`phase-btn ${phaseInfo.currentPhase === 'digital' ? 'active' : ''}`}
                                onClick={() => forcePhaseTransition('digital')}
                                title="Forcer la phase digital"
                            >
                                🔌
                            </button>
                            <button
                                className={`edit-btn ${editMode ? 'active' : ''}`}
                                onClick={toggleEditMode}
                                title={editMode ? "Quitter le mode édition" : "Modifier les paramètres"}
                            >
                                ✎
                            </button>
                        </>
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

                    {/* Affichage des sons nature */}
                    {natureSounds.length > 0 && (
                        <div className="sound-category">
                            <h4 className="category-title nature">
                                🌿 Sons Nature ({natureSounds.length})
                            </h4>
                            <div className="sound-list">
                                {natureSounds.map(soundId => {
                                    const sound = soundsState[soundId];
                                    const editValue = editValues[soundId] || sound.config;

                                    // Calculer la barre de progression
                                    let progressPercent = 0;
                                    let progressLabel = '';

                                    if (sound.isPlaying && sound.playbackInfo) {
                                        progressPercent = sound.playbackInfo.progress;
                                        progressLabel = sound.playbackInfo.remainingText;
                                    } else if (sound.remainingMs > 0) {
                                        const totalTime = (sound.config.minInterval + sound.config.maxInterval) * 500;
                                        const elapsed = totalTime - sound.remainingMs;
                                        progressPercent = Math.min(100, Math.max(0, (elapsed / totalTime) * 100));
                                        progressLabel = sound.nextPlayIn;
                                    }

                                    return (
                                        <div key={soundId} className={`sound-item ${sound.isPlaying ? 'playing' : ''} ${!sound.isActiveInCurrentPhase ? 'inactive-phase' : ''}`}>
                                            {/* Contenu identique au composant original mais avec les nouvelles classes */}
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

                    {/* Affichage des sons digitaux */}
                    {digitalSounds.length > 0 && (
                        <div className="sound-category">
                            <h4 className="category-title digital">
                                🔌 Sons Digitaux ({digitalSounds.length})
                            </h4>
                            <div className="sound-list">
                                {digitalSounds.map(soundId => {
                                    const sound = soundsState[soundId];
                                    const editValue = editValues[soundId] || sound.config;

                                    // Calculer la barre de progression (même logique que pour les sons nature)
                                    let progressPercent = 0;
                                    let progressLabel = '';

                                    if (sound.isPlaying && sound.playbackInfo) {
                                        progressPercent = sound.playbackInfo.progress;
                                        progressLabel = sound.playbackInfo.remainingText;
                                    } else if (sound.remainingMs > 0) {
                                        const totalTime = (sound.config.minInterval + sound.config.maxInterval) * 500;
                                        const elapsed = totalTime - sound.remainingMs;
                                        progressPercent = Math.min(100, Math.max(0, (elapsed / totalTime) * 100));
                                        progressLabel = sound.nextPlayIn;
                                    }

                                    return (
                                        <div key={soundId} className={`sound-item digital ${sound.isPlaying ? 'playing' : ''} ${!sound.isActiveInCurrentPhase ? 'inactive-phase' : ''}`}>
                                            {/* Même contenu que les sons nature */}
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
                    max-width: 600px;
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

                .title-section {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .phase-info {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                .phase-indicator {
                    font-size: 10px;
                    padding: 1px 4px;
                    border-radius: 6px;
                    font-weight: bold;
                }

                .phase-indicator.nature {
                    background-color: #2d5a2d;
                    color: #90ee90;
                }

                .phase-indicator.digital {
                    background-color: #2d4a5a;
                    color: #87ceeb;
                }

                .progress-text {
                    font-size: 9px;
                    color: #ccc;
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

                .collapse-btn, .edit-btn, .play-btn, .phase-btn {
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

                .collapse-btn:hover, .edit-btn:hover, .play-btn:hover, .phase-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .edit-btn.active, .phase-btn.active {
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
                    gap: 10px;
                }

                .sound-category {
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    padding: 8px;
                }

                .category-title {
                    margin: 0 0 8px 0;
                    font-size: 13px;
                    font-weight: bold;
                    padding-bottom: 4px;
                    border-bottom: 1px dashed rgba(255, 255, 255, 0.2);
                }

                .category-title.nature {
                    color: #90ee90;
                }

                .category-title.digital {
                    color: #87ceeb;
                }

                .sound-list {
                    display: flex;
                    flex-direction: row;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .sound-item {
                    background-color: rgba(30, 30, 30, 0.7);
                    border-radius: 4px;
                    padding: 6px;
                    border-left: 3px solid #555;
                    position: relative;
                    min-width: 180px;
                }

                .sound-item.playing {
                    border-left-color: #4CAF50;
                    background-color: rgba(40, 60, 40, 0.7);
                }

                .sound-item.digital {
                    border-left-color: #87ceeb;
                }

                .sound-item.digital.playing {
                    border-left-color: #4169e1;
                    background-color: rgba(40, 50, 70, 0.7);
                }

                .sound-item.inactive-phase {
                    opacity: 0.5;
                    border-left-color: #666;
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