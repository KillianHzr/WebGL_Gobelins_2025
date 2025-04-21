import {useEffect, useRef} from 'react'

// Custom hook to handle animation loops outside of the R3F ecosystem if needed
export default function useAnimationLoop(callback) {
    const requestRef = useRef()
    const previousTimeRef = useRef()

    const animate = time => {
        if (previousTimeRef.current !== undefined) {
            const deltaTime = (time - previousTimeRef.current) / 1000
            callback(deltaTime)
        }
        previousTimeRef.current = time
        requestRef.current = requestAnimationFrame(animate)
    }

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(requestRef.current)
    }, [])
}