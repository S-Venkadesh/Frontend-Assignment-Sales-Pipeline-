import { useState } from 'react'
import { DEFAULT_NETWORK, dealRepository } from '../data/dealRepository.js'

export function NetworkSimulator() {
  const [settings, setSettings] = useState(DEFAULT_NETWORK)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function applySettings(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const next = dealRepository.configureNetwork({ minDelay: Number(form.get('minDelay')), maxDelay: Number(form.get('maxDelay')), failureRate: Number(form.get('failureRate')) / 100 })
      setSettings(next)
      setError('')
      setMessage('Settings applied to future saves.')
    } catch (failure) {
      setError(failure.message)
      setMessage('')
    }
  }

  return (
    <details className="network-simulator">
      <summary>Network simulator <span>{settings.minDelay}–{settings.maxDelay} ms · {Math.round(settings.failureRate * 100)}% failures</span></summary>

      <form onSubmit={applySettings}>
        <label>Minimum delay (ms)
          <input name="minDelay" type="number" min="0" max="10000" step="1" defaultValue={settings.minDelay} required />
        </label>

        <label>Maximum delay (ms)
          <input name="maxDelay" type="number" min="0" max="10000" step="1" defaultValue={settings.maxDelay} required />
        </label>

        <label>Failure rate (%)
          <input name="failureRate" type="number" min="0" max="100" step="1" defaultValue={settings.failureRate * 100} required />
        </label>

        <button className="primary-button" type="submit">Apply settings</button>

        <p className="simulator-hint">Failures are independent per deal. Each request uses the settings active when it starts.</p>

        {message && <p className="simulator-message" role="status">{message}</p>}

        {error && <p className="simulator-error" role="alert">{error}</p>}
      </form>
    </details>
  )
}
