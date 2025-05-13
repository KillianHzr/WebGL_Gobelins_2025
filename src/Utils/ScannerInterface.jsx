import React, { useEffect, useState, useRef } from 'react';
import useStore from '../Store/useStore';
import { EventBus } from './EventEmitter';
import { audioManager } from './AudioManager';

export default function ScannerInterface() {
    const [isVisible, setIsVisible] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [showNotification, setShowNotification] = useState(false);
    const [pulseSize, setPulseSize] = useState(0);
    const [progressSize, setProgressSize] = useState(0);
    // Nouvel état pour le hover
    const [isButtonHovered, setIsButtonHovered] = useState(false);
    const scanLineRef = useRef(null);
    const interaction = useStore(state => state.interaction);
    const scanTimerRef = useRef(null);
    const scanStartTimeRef = useRef(null);
    const scanSoundIdRef = useRef(null);
    const scanDuration = 7000; // 7 seconds scan time

    // Monitor state changes to determine when to display the interface
    useEffect(() => {
        if (interaction?.showScannerInterface) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
            // Clean up scanning state if we hide the interface
            if (isScanning) {
                stopScanning();
            }
        }
    }, [interaction?.showScannerInterface]);

    // Create pulsation effect that syncs with scan line
    useEffect(() => {
        if (isScanning) {
            // La pulsation sera mise à jour dans le timer du scan progress
        } else {
            setPulseSize(0);
            setProgressSize(0); // Réinitialiser la taille de progression
        }

        return () => {
            // Cleanup handled in the main timer cleanup
        };
    }, [isScanning]);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (scanTimerRef.current) {
                clearInterval(scanTimerRef.current);
            }

            // Arrêter le son si le composant est démonté
            if (scanSoundIdRef.current) {
                audioManager.stopSound('scan-start');
                scanSoundIdRef.current = null;
            }
        };
    }, []);

    // Manage scan line animation based on scanning state
    useEffect(() => {
        if (scanLineRef.current) {
            if (isScanning) {
                // Calculate number of iterations based on scan duration
                // Each iteration is 2 seconds (1s up + 1s down)
                const iterationCount = Math.ceil(scanDuration / 2000);
                scanLineRef.current.style.animationIterationCount = iterationCount;
                scanLineRef.current.style.animationPlayState = 'running';
            } else {
                scanLineRef.current.style.animationPlayState = 'paused';
            }
        }
    }, [isScanning, scanDuration]);

    // Start the scanning process
    const startScanning = () => {
        // Jouer et stocker l'ID du son de démarrage
        scanSoundIdRef.current = audioManager.playSound('scan-start');

        setIsScanning(true);
        setScanProgress(0);
        setPulseSize(0);
        setProgressSize(0); // Réinitialiser la taille de progression
        scanStartTimeRef.current = Date.now();

        // Create interval to update progress and sync pulsation
        scanTimerRef.current = setInterval(() => {
            const elapsed = Date.now() - scanStartTimeRef.current;
            const progress = Math.min((elapsed / scanDuration) * 100, 100);
            setScanProgress(progress);

            // Mettre à jour la taille de progression (similaire à l'appui long)
            setProgressSize(progress);

            // Update pulse size based on scan line position
            // We use a cosine wave to match the up/down movement of scan line
            // Map progress 0-100 to pulse position for one full oscillation
            const pulsePosition = (elapsed % 2000) / 2000; // 0 to 1 every 2 seconds (matches scan line)
            setPulseSize(Math.sin(pulsePosition * Math.PI * 2) * 0.1 + 1); // Similaire à l'animation du long press

            if (progress >= 100) {
                completeScan();
            }
        }, 50);
    };

    // Stop the scanning process without completing
    const stopScanning = () => {
        if (scanTimerRef.current) {
            clearInterval(scanTimerRef.current);
            scanTimerRef.current = null;
        }

        // Arrêter le son de démarrage s'il joue encore
        if (scanSoundIdRef.current) {
            audioManager.stopSound('scan-start');
            scanSoundIdRef.current = null;
        }

        audioManager.playSound('scan-cancel');
        setIsScanning(false);
        setScanProgress(0);
        setPulseSize(0);
        setProgressSize(0); // Réinitialiser la taille de progression

        // Émettre un événement pour indiquer que le scan a été annulé
        EventBus.trigger('interface-action', {
            type: 'scanner',
            action: 'cancel',
            result: 'incomplete'
        });
    };

    // Complete the scanning process successfully
    const completeScan = () => {
        if (scanTimerRef.current) {
            clearInterval(scanTimerRef.current);
            scanTimerRef.current = null;
        }

        // Arrêter le son de démarrage s'il joue encore
        if (scanSoundIdRef.current) {
            audioManager.stopSound('scan-start');
            scanSoundIdRef.current = null;
        }

        setIsScanning(false);
        setScanProgress(0);
        setPulseSize(0);
        setProgressSize(0); // Réinitialiser la taille de progression

        audioManager.playSound('scan-complete');

        setIsVisible(false);

        if (interaction?.setShowScannerInterface) {
            interaction.setShowScannerInterface(false);
        }

        setShowNotification(true);

        // Émettre un événement pour indiquer que l'interface a été fermée
        EventBus.trigger('interface-action', {
            type: 'scanner',
            action: 'close',
            result: 'complete'
        });

        setTimeout(() => {
            setShowNotification(false);
        }, 3000);

        if (interaction?.completeInteraction) {
            interaction.completeInteraction();
            window.doJumpToChapter(0.01)

        }
    };

    // Handle button press and hold actions
    const handleScanButtonDown = () => {
        startScanning();
    };

    const handleScanButtonUp = () => {
        if (isScanning && scanProgress < 100) {
            stopScanning();
        }
    };

    // Gérer les événements de hover sur le bouton
    const handleButtonMouseEnter = () => {
        setIsButtonHovered(true);
    };

    const handleButtonMouseLeave = () => {
        setIsButtonHovered(false);
    };

    // Appliquer les styles de pulsation comme dans le LONG_PRESS
    const getButtonStyle = () => {
        if (!isScanning) {
            return {
                width: '72px',
                height: '72px'
            };
        }

        // Calculer la taille de la progression (comme pour le long press)
        // 72px de base, puis croissance jusqu'à 88px (16px de plus) en fonction de la progression
        const baseSize = 72;
        const maxGrowth = 16;
        const progressGrowth = (progressSize / 100) * maxGrowth;

        // Appliquer la pulsation en plus de la croissance due à la progression
        const width = baseSize + progressGrowth;
        const height = baseSize + progressGrowth;

        return {
            width: `${width}px`,
            height: `${height}px`,
            borderColor: '#F9FEFF'
        };
    };

    if (!isVisible && !showNotification) return null;

    return (
        <>
            {/* Scanner interface */}
            {isVisible && (
                <div className="scanner-interface">
                    {/* Viewport with corners */}
                    <div className="scanner-viewport">
                        {/* Corner elements */}
                        <div className="scanner-viewport-corner-bl"></div>
                        <div className="scanner-viewport-corner-br"></div>

                        {/* SVG target in center instead of square */}
                        <div className="scanner-viewport-target">
                            <svg viewBox="0 0 187 187" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" clipRule="evenodd" d="M130 1H137C164.062 1 186 22.938 186 50V58H187V50C187 22.3858 164.614 0 137 0H130V1ZM58 0H50C22.3858 0 0 22.3858 0 50V58H1V50C1 22.9381 22.938 1 50 1H58V0ZM1 130H0V137C0 164.614 22.3858 187 50 187H58V186H50C22.9381 186 1 164.062 1 137V130ZM137 187H130V186H137C164.062 186 186 164.062 186 137V130H187V137C187 164.614 164.614 187 137 187Z" fill="#F9FEFF"/>
                            </svg>
                        </div>

                        {/* Scanning line - visible only when scanning */}
                        {isScanning && (
                            <div
                                ref={scanLineRef}
                                className="scanner-scan-line"
                            ></div>
                        )}

                        {/* Scan button */}
                        <div
                            className={`scanner-interface-scan-button ${isButtonHovered ? 'scanner-interface-scan-button-hover' : ''}`}
                        >
                            <div
                                className={`scanner-interface-scan-button-inner ${
                                    isButtonHovered
                                        ? 'scanner-interface-scan-button-inner-hovered'
                                        : 'scanner-interface-scan-button-inner-default'
                                }`}
                                onMouseDown={handleScanButtonDown}
                                onMouseUp={handleScanButtonUp}
                                onMouseLeave={() => {
                                    handleButtonMouseLeave();
                                    handleScanButtonUp();
                                }}
                                onMouseEnter={handleButtonMouseEnter}
                                onTouchStart={handleScanButtonDown}
                                onTouchEnd={handleScanButtonUp}
                            >
                                <div className="scanner-interface-scan-button-inner-text">
                                    Scan
                                </div>
                                <div
                                    className="scanner-interface-scan-button-inner-progress"
                                    style={getButtonStyle()}
                                >
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Notification */}
            {showNotification && (
                <div className="scanner-notification">
                    Scanner completé avec succès
                </div>
            )}
        </>
    );
}