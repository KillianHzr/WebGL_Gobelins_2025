import { useEffect } from 'react';
import useStore from '../Store/useStore';
import GUI from 'lil-gui';

/**
 * Component that initializes debug features based on URL hash
 * This component doesn't render anything but handles the side effects
 * related to debug mode initialization
 */
const DebugInitializer = () => {
    const { debug, setGui } = useStore();

    useEffect(() => {
        // Initialize GUI if debug mode is active
        if (debug?.active && debug?.showGui) {
            // Create GUI only if it doesn't exist yet
            const gui = new GUI();
            gui.title('Debug Controls');
            setGui(gui);

            console.log('Debug GUI initialized');
        }

        // Cleanup function - destroy GUI on unmount
        return () => {
            const { gui } = useStore.getState();
            if (gui) {
                gui.destroy();
                setGui(null);
            }
        };
    }, [debug?.active, debug?.showGui, setGui]);

    // This component doesn't render anything
    return null;
};

export default DebugInitializer;