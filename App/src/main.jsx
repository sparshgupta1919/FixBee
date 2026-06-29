import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Capture initial viewport height before keyboard opens.
function setInitialVh() {
    document.documentElement.style.setProperty(
        '--initial-vh', `${window.innerHeight}px`
    )
}
setInitialVh()
window.addEventListener('orientationchange', () => {
    setTimeout(setInitialVh, 150)
})

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
