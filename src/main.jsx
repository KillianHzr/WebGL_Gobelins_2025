import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './style.css'

import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'

// Activer Theatre.js Studio en mode développement
studio.extend(extension)
studio.initialize()

document.addEventListener('wheel', (e) => {
    if (!e.target.closest('.theatre-studio-root')) {
        e.preventDefault()
    }
}, { passive: false })

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)