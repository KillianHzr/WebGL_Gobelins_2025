import React, { useEffect, useState } from 'react';
import useStore from '../Store/useStore';

/**
 * Composant de débogage pour visualiser l'état du système de sons bonus
 * S'affiche uniquement en mode debug
 */
const BonusSoundsDebugger = () => {
    const { debug } = useStore();
    const [systemState, setSystemState] = useState({});
    const [visible, setVisible] = useState(false);
    const [collapsed, setCollapsed] = useState(true);

    // Surveiller l'état du mode debug pour afficher/masquer le débogueur
    useEffect(() => {
        if (debug?.active) {
            setVisible(true);
        } else {
            setVisible(false);
        }
    }, [debug]);

    // Mettre à jour l'état du système toutes les 500ms
    useEffect(() => {
        if (!visible) return;

        const updateSystemState = () => {
            if (!window.audioManager?.bonusSoundsManager) return;

            const debugState = window.audioManager.bonusSoundsManager.getDebugState();
            setSystemState(debugState);
        };

        // Mettre à jour immédiatement puis régulièrement
        updateSystemState();
        const interval = setInterval(updateSystemState, 500);

        return () => {
            clearInterval(interval);
        };
    }, [visible]);

    // Toggle état réduit/déplié
    const toggleCollapsed = () => {
        setCollapsed(!collapsed);
    };

    // Force le déclenchement d'un son
    const forceTriggerSound = (soundType = null) => {
        if (window.audioManager?.bonusSoundsManager) {
            const result = window.audioManager.bonusSoundsManager.forceTriggerSound(soundType);
            console.log('BonusSoundsDebugger: Force trigger result:', result);
        }
    };

    // Active/désactive le système
    const toggleSystem = () => {
        if (window.audioManager?.bonusSoundsManager) {
            const newState = !systemState.active;
            window.audioManager.bonusSoundsManager.setActive(newState);
        }
    };

    // Formater le temps en secondes
    const formatTime = (ms) => {
        if (ms === null) return 'N/A';
        return `${(ms / 1000).toFixed(1)}s`;
    };

    // Déterminer la couleur de statut d'une condition
    const getConditionColor = (condition) => {
        return condition ? '#4CAF50' : '#f44336';
    };

    // Ne rien afficher si le débogueur n'est pas visible
    if (!visible) return null;

    const isSystemReady = systemState.active !== undefined;
    const canTriggerSound = isSystemReady && Object.values(systemState.conditions || {}).every(Boolean);

    return (
        <div className={`bonus-sounds-debugger ${collapsed ? 'collapsed' : ''}`}>
            <div className="debugger-header">
                <div className="header-main">
                    <div className="title-section">
                        <h3>Sons Bonus</h3>
                        <div className="system-info">
                            <span className={`type-indicator ${systemState.currentSoundType || 'unknown'}`}>
                                {systemState.currentSoundType === 'digital' ? '🔌 Digital' : '🌿 Nature'}
                                {systemState.currentScrollProgress !== undefined &&
                                    ` (${(systemState.currentScrollProgress * 100).toFixed(1)}%)`
                                }
                            </span>
                        </div>
                    </div>
                    <div className={`system-status ${systemState.active ? 'active' : 'inactive'}`}>
                        {systemState.active ? 'Actif' : 'Inactif'}
                    </div>
                </div>
                <div className="controls">
                    {!collapsed && (
                        <>
                            <button
                                className="toggle-btn"
                                onClick={toggleSystem}
                                title={systemState.active ? "Désactiver le système" : "Activer le système"}
                            >
                                {systemState.active ? '⏸️' : '▶️'}
                            </button>
                            <button
                                className="trigger-btn nature"
                                onClick={() => forceTriggerSound('nature')}
                                title="Forcer un son nature"
                            >
                                🌿
                            </button>
                            <button
                                className="trigger-btn digital"
                                onClick={() => forceTriggerSound('digital')}
                                title="Forcer un son digital"
                            >
                                🔌
                            </button>
                            <button
                                className="trigger-btn auto"
                                onClick={() => forceTriggerSound()}
                                title="Forcer un son automatique"
                            >
                                🎲
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

            {!collapsed && isSystemReady && (
                <div className="debugger-content">
                    {/* Indicateur global de déclenchement */}
                    <div className={`trigger-status ${canTriggerSound ? 'ready' : 'blocked'}`}>
                        <span className="status-icon">
                            {canTriggerSound ? '✅' : '⏳'}
                        </span>
                        <span className="status-text">
                            {canTriggerSound ? 'Prêt à déclencher' : 'En attente des conditions'}
                        </span>
                    </div>

                    {/* État des files d'attente */}
                    <div className="queues-section">
                        <h4>Files d'attente</h4>
                        <div className="queue-info">
                            <div className="queue-item nature">
                                <span className="queue-label">🌿 Nature:</span>
                                <span className="queue-count">{systemState.soundQueues?.nature || 0} sons restants</span>
                            </div>
                            <div className="queue-item digital">
                                <span className="queue-label">🔌 Digital:</span>
                                <span className="queue-count">{systemState.soundQueues?.digital || 0} sons restants</span>
                            </div>
                        </div>
                    </div>

                    {/* Conditions de déclenchement */}
                    <div className="conditions-section">
                        <h4>Conditions</h4>
                        <div className="conditions-list">
                            <div className="condition-item">
                                <span
                                    className="condition-indicator"
                                    style={{ color: getConditionColor(systemState.conditions?.hasCompletedInteraction) }}
                                >
                                    ●
                                </span>
                                <span className="condition-text">
                                    Au moins une interaction validée
                                </span>
                                <span className="condition-value">
                                    {systemState.hasCompletedInteraction ? 'Oui' : 'Non'}
                                </span>
                            </div>

                            <div className="condition-item">
                                <span
                                    className="condition-indicator"
                                    style={{ color: getConditionColor(systemState.conditions?.scrollTimeout) }}
                                >
                                    ●
                                </span>
                                <span className="condition-text">
                                    Pas de scroll depuis 3s
                                </span>
                                <span className="condition-value">
                                    {formatTime(systemState.timeSinceLastScroll)}
                                </span>
                            </div>

                            <div className="condition-item">
                                <span
                                    className="condition-indicator"
                                    style={{ color: getConditionColor(systemState.conditions?.notInInteraction) }}
                                >
                                    ●
                                </span>
                                <span className="condition-text">
                                    Pas d'interaction/interface
                                </span>
                                <span className="condition-value">
                                    {systemState.isInInteraction || systemState.isInterfaceOpen ? 'En cours' : 'Libre'}
                                </span>
                            </div>

                            <div className="condition-item">
                                <span
                                    className="condition-indicator"
                                    style={{ color: getConditionColor(systemState.conditions?.timeSinceInteraction) }}
                                >
                                    ●
                                </span>
                                <span className="condition-text">
                                    5s depuis dernière interaction
                                </span>
                                <span className="condition-value">
                                    {formatTime(systemState.timeSinceLastInteraction)}
                                </span>
                            </div>

                            <div className="condition-item">
                                <span
                                    className="condition-indicator"
                                    style={{ color: getConditionColor(systemState.conditions?.soundInterval) }}
                                >
                                    ●
                                </span>
                                <span className="condition-text">
                                    10s depuis dernier son
                                </span>
                                <span className="condition-value">
                                    {formatTime(systemState.timeSinceLastSound)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx="true">{`
                .bonus-sounds-debugger {
                    position: fixed;
                    bottom: 10px;
                    left: 10px;
                    z-index: 1000;
                    background-color: rgba(0, 0, 0, 0.9);
                    color: white;
                    padding: 12px;
                    border-radius: 8px;
                    font-family: monospace;
                    font-size: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    border: 1px solid rgba(255, 165, 0, 0.3);
                    transition: all 0.3s ease;
                    max-width: 350px;
                    min-width: 200px;
                }

                .bonus-sounds-debugger.collapsed {
                    width: auto;
                }

                .debugger-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(255, 165, 0, 0.3);
                    margin-bottom: 8px;
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
                    gap: 4px;
                }

                .title-section h3 {
                    margin: 0;
                    color: #FFA500;
                    font-size: 14px;
                }

                .system-info {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                .type-indicator {
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 6px;
                    font-weight: bold;
                }

                .type-indicator.nature {
                    background-color: #2d5a2d;
                    color: #90ee90;
                }

                .type-indicator.digital {
                    background-color: #2d4a5a;
                    color: #87ceeb;
                }

                .system-status {
                    font-size: 10px;
                    padding: 3px 8px;
                    border-radius: 8px;
                    background-color: #555;
                    color: #ccc;
                    font-weight: bold;
                }

                .system-status.active {
                    background-color: #FFA500;
                    color: white;
                }

                .controls {
                    display: flex;
                    gap: 4px;
                }

                .collapse-btn, .toggle-btn, .trigger-btn {
                    background: none;
                    border: 1px solid rgba(255, 165, 0, 0.3);
                    color: #FFA500;
                    font-size: 12px;
                    cursor: pointer;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    border-radius: 4px;
                    transition: all 0.2s;
                }

                .collapse-btn:hover, .toggle-btn:hover, .trigger-btn:hover {
                    background: rgba(255, 165, 0, 0.2);
                    border-color: #FFA500;
                }

                .trigger-btn.nature:hover {
                    background: rgba(144, 238, 144, 0.2);
                    border-color: #90ee90;
                    color: #90ee90;
                }

                .trigger-btn.digital:hover {
                    background: rgba(135, 206, 235, 0.2);
                    border-color: #87ceeb;
                    color: #87ceeb;
                }

                .debugger-content {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .trigger-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 10px;
                    border-radius: 6px;
                    font-weight: bold;
                    font-size: 11px;
                }

                .trigger-status.ready {
                    background-color: rgba(76, 175, 80, 0.2);
                    border: 1px solid #4CAF50;
                    color: #4CAF50;
                }

                .trigger-status.blocked {
                    background-color: rgba(158, 158, 158, 0.2);
                    border: 1px solid #9e9e9e;
                    color: #9e9e9e;
                }

                .queues-section h4, .conditions-section h4 {
                    margin: 0 0 6px 0;
                    color: #FFA500;
                    font-size: 12px;
                    font-weight: bold;
                }

                .queue-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .queue-item {
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                }

                .queue-label {
                    color: #ccc;
                }

                .queue-count {
                    color: white;
                    font-weight: bold;
                }

                .conditions-list {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .condition-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                }

                .condition-indicator {
                    font-size: 8px;
                    font-weight: bold;
                }

                .condition-text {
                    flex-grow: 1;
                    color: #ccc;
                }

                .condition-value {
                    color: white;
                    font-weight: bold;
                    min-width: 50px;
                    text-align: right;
                    font-size: 10px;
                }

                .collapsed .debugger-header {
                    border-bottom: none;
                    margin-bottom: 0;
                    padding-bottom: 0;
                }
            `}</style>
        </div>
    );
};

export default BonusSoundsDebugger;