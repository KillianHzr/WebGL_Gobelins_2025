import React, { useEffect, useState, useRef } from 'react';
import useStore from '../Store/useStore';
import { audioManager } from './AudioManager';

export default function ScannerInterface() {
    const [isVisible, setIsVisible] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [showNotification, setShowNotification] = useState(false);
    const scanLineRef = useRef(null);
    const interaction = useStore(state => state.interaction);
    const scanTimerRef = useRef(null);
    const scanStartTimeRef = useRef(null);
    const scanSoundIdRef = useRef(null); // Pour stocker l'ID du son de démarrage
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
        scanStartTimeRef.current = Date.now();

        // Create interval to update progress
        scanTimerRef.current = setInterval(() => {
            const elapsed = Date.now() - scanStartTimeRef.current;
            const progress = Math.min((elapsed / scanDuration) * 100, 100);
            setScanProgress(progress);

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

        audioManager.playSound('scan-complete');

        setIsVisible(false);

        if (interaction?.setShowScannerInterface) {
            interaction.setShowScannerInterface(false);
        }

        setShowNotification(true);

        setTimeout(() => {
            setShowNotification(false);
        }, 3000);

        if (interaction?.completeInteraction) {
            interaction.completeInteraction();
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

                        {/* Progress bar for scanning */}
                        {isScanning && (
                            <div className="scanner-progress-container">
                                <div
                                    className="scanner-progress-bar"
                                    style={{ width: `${scanProgress}%` }}
                                ></div>
                            </div>
                        )}

                        {/* Scan button */}
                        <button
                            onMouseDown={handleScanButtonDown}
                            onMouseUp={handleScanButtonUp}
                            onMouseLeave={handleScanButtonUp}
                            onTouchStart={handleScanButtonDown}
                            onTouchEnd={handleScanButtonUp}
                            className="scanner-button"
                        >
                            <span className="scanner-objective"></span>
                        </button>
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