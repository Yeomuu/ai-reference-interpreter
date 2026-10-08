import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles/tokens.css'
import './styles/app.css'
import './styles/studio.css'
import './styles/viewport.css'
import './styles/simplified.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

import './styles/layout-mapping.css'
import './styles/respace.css'
