import {useEffect, useState} from 'react'

// Custom hook to handle canvas sizing
export default function useCanvasSize() {
    const [size, setSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: Math.min(window.devicePixelRatio, 2)
    })

    useEffect(() => {
        // Resize handler
        const handleResize = () => {
            setSize({
                width: window.innerWidth,
                height: window.innerHeight,
                pixelRatio: Math.min(window.devicePixelRatio, 2)
            })
        }

        // Register and clean up the event listener
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return size
}