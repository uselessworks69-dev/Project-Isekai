import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// Import global styles
import './assets/css/main.css'

// Create Vue app
const app = createApp(App)

// Use Pinia for state management
const pinia = createPinia()
app.use(pinia)

// Mount the app
app.mount('#app')

// Global error handler for system notifications
app.config.errorHandler = (err, instance, info) => {
  console.error('[System Error]:', err)
  console.error('[Component]:', instance?.$options.name || 'Unknown')
  console.error('[Info]:', info)
  
  // In production, this would send to error tracking service
  if (import.meta.env.PROD) {
    // Send error to backend
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: err.message,
        component: instance?.$options.name,
        info: info,
        timestamp: new Date().toISOString()
      })
    }).catch(console.error)
  }
}

// Global properties for system access
app.config.globalProperties.$system = {
  version: '0.3.0',
  env: import.meta.env.MODE,
  notify: (message, type = 'info') => {
    // This would dispatch to a notification system
    console.log(`[${type.toUpperCase()}] ${message}`)
  }
}

console.log(`
%cPROJECT ISEKAI %cv0.3.0
%cSystem Initialized - All protocols active
`,
'font-family: Orbitron, monospace; font-size: 24px; color: #00f3ff; font-weight: 900;',
'font-family: Exo 2, sans-serif; font-size: 12px; color: #9d4edd;',
'font-family: Exo 2, sans-serif; font-size: 12px; color: #6d6dff;'
)
