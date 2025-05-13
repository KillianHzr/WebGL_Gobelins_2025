import React, { useState, useEffect, useRef } from 'react';
import { EventBus } from './EventEmitter';
import useStore from '../Store/useStore';

const LoadingManager = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [assetsLoaded, setAssetsLoaded] = useState(0);
    const [totalAssets, setTotalAssets] = useState(100);
    const progressRef = useRef(0);
    const isCompleteRef = useRef(false);
    const forestReadyTimerRef = useRef(null);
    const assetsCountRef = useRef(0);
    const forestStartedLoadingRef = useRef(false);

    // Log progress updates for debugging
    useEffect(() => {
        console.log(`Loading progress: ${progress}%`);
    }, [progress]);

    useEffect(() => {
        // Initialize console log capturing if not already done
        if (!window._loadingLogs) {
            window._loadingLogs = [];
            const originalLog = console.log;
            console.log = function(...args) {
                const logStr = args.join(' ');
                window._loadingLogs.push(logStr);
                if (window._loadingLogs.length > 100) {
                    window._loadingLogs.shift();
                }

                // Check for the French "Forest est prête" message
                if (logStr.includes("Forest est prête")) {
                    console.warn("Detected 'Forest est prête' in logs - completing loading");
                    if (!isCompleteRef.current) {
                        handleForestReady();
                    }
                }

                originalLog.apply(console, args);
            };
        }

        const handleAssetLoaded = (assetName) => {
            console.log(`Asset loaded: ${assetName}`);
            setAssetsLoaded(prev => {
                const newValue = prev + 1;
                const newProgress = Math.min(Math.floor((newValue / totalAssets) * 95), 95);
                setProgress(newProgress);
                progressRef.current = newProgress;
                return newValue;
            });
        };

        // Set total assets from the AssetManager with better fallback
        const updateTotalAssets = () => {
            if (window.assetManager) {
                if (window.assetManager.assetsToLoad) {
                    const count = window.assetManager.assetsToLoad.length;
                    console.log(`Asset Manager reports ${count} assets to load`);
                    if (count > 0) {
                        setTotalAssets(count);
                        assetsCountRef.current = count;
                    }
                } else if (window.assetManager.items) {
                    const count = Object.keys(window.assetManager.items).length + 50;
                    console.log(`Estimated ${count} assets based on items`);
                    if (count > 0 && count > assetsCountRef.current) {
                        setTotalAssets(count);
                        assetsCountRef.current = count;
                    }
                }
            }
        };

        // Track forest scene start loading
        const handleForestStartLoading = () => {
            console.log("Forest started loading");
            forestStartedLoadingRef.current = true;

            if (assetsCountRef.current < 50) {
                setTotalAssets(100);
                assetsCountRef.current = 100;
            }

            if (progressRef.current < 10) {
                setProgress(10);
                progressRef.current = 10;
            }
        };

        // Handle forest scene ready event - this means everything is loaded
        const handleForestReady = () => {
            console.log("Forest is ready! Setting progress to 100%");

            if (forestReadyTimerRef.current) {
                clearTimeout(forestReadyTimerRef.current);
            }

            setProgress(99);
            progressRef.current = 99;

            forestReadyTimerRef.current = setTimeout(() => {
                setProgress(100);
                progressRef.current = 100;

                if (!isCompleteRef.current) {
                    isCompleteRef.current = true;
                    setTimeout(() => {
                        if (onComplete) onComplete();
                    }, 500);
                }
            }, 300);
        };

        // Get initial total assets count
        updateTotalAssets();

        // Setup event listeners for multiple events
        const assetLoadedUnsubscribe = EventBus.on('assetLoaded', handleAssetLoaded);
        const assetLoadedAltUnsubscribe = EventBus.on('asset-loaded', handleAssetLoaded);
        const forestReadyUnsubscribe = EventBus.on('forest-ready', handleForestReady);
        const forestSceneReadyUnsubscribe = EventBus.on('forest-scene-ready', handleForestReady);
        const assetsInitializedUnsubscribe = EventBus.on('assetsInitialized', updateTotalAssets);
        const forestStartUnsubscribe = EventBus.on('forest-scene-loading', handleForestStartLoading);

        // Monitor for loading activities in the logs
        const modelLoadingUnsubscribe = EventBus.on('model-loading', () => {
            console.log("Model loading detected");
            if (progressRef.current < 30) {
                setProgress(30);
                progressRef.current = 30;
            }
        });

        // Also listen for asset manager's ready event
        const assetManagerReadyUnsubscribe = EventBus.on('ready', () => {
            console.log("Asset Manager ready event detected");
            if (progressRef.current < 50) {
                setProgress(50);
                progressRef.current = 50;
            }
            updateTotalAssets();
        });

        // In case the forest-ready event was missed, check every second if forest is loaded
        const checkInterval = setInterval(() => {
            const store = useStore.getState();

            // Check if forest is loaded via store
            if (store.loaded && progressRef.current < 100) {
                console.log("Forest loaded detected via store check");
                handleForestReady();
            }

            // Regularly check for the French "Forest est prête" message in logs
            const logs = getRecentLogs();
            if (logs.includes("Forest est prête") && progressRef.current < 100) {
                console.log("Detected 'Forest est prête' in regular check - completing loading");
                handleForestReady();
            }

            // Gradually increase progress if we detect loading but no event updates
            // This ensures the progress bar doesn't get stuck
            if (!isCompleteRef.current && forestStartedLoadingRef.current) {
                if (logs.includes("Asset") && progressRef.current < 40) {
                    setProgress(prev => Math.max(prev + 1, 40));
                    progressRef.current = Math.max(progressRef.current + 1, 40);
                }

                if (logs.includes("Model") && progressRef.current < 60) {
                    setProgress(Math.max(progressRef.current, 60));
                    progressRef.current = Math.max(progressRef.current, 60);
                }

                if (logs.includes("Forest") && progressRef.current < 80) {
                    setProgress(Math.max(progressRef.current, 80));
                    progressRef.current = Math.max(progressRef.current, 80);
                }
            }
        }, 500);

        // Backup fallback timer in case other methods fail
        const fallbackTimer = setTimeout(() => {
            if (!isCompleteRef.current) {
                const allLogs = window._loadingLogs ? window._loadingLogs.join(' ') : '';

                if (allLogs.includes("Forest est prête")) {
                    console.log("Final fallback: Detected 'Forest est prête' in logs but missed event - completing loading");
                    handleForestReady();
                }
            }
        }, 20000);

        return () => {
            assetLoadedUnsubscribe();
            assetLoadedAltUnsubscribe();
            forestReadyUnsubscribe();
            forestSceneReadyUnsubscribe();
            assetsInitializedUnsubscribe();
            forestStartUnsubscribe();
            modelLoadingUnsubscribe();
            assetManagerReadyUnsubscribe();
            clearInterval(checkInterval);
            clearTimeout(fallbackTimer);

            if (forestReadyTimerRef.current) {
                clearTimeout(forestReadyTimerRef.current);
            }
        };
    }, [onComplete]);

    // Helper function to check recent console logs for progress indicators
    const getRecentLogs = () => {
        if (window._loadingLogs) {
            return window._loadingLogs.join(' ');
        }

        if (console && console.logs) {
            return console.logs.join(' ');
        }

        return '';
    };

    return { progress };
};

export default LoadingManager;