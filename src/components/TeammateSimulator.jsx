import { useEffect, useState } from 'react'
import { dealRepository } from '../data/dealRepository.js'
import { OWNERS, STAGES } from '../data/deals.js'

const stageNames = Object.fromEntries(STAGES.map((stage) => [stage.id, stage.label]))

export function TeammateSimulator({ activity, disabled }) {
  const [enabled, setEnabled] = useState(false)
  const [interval, setIntervalMs] = useState(5000)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || disabled) return
    const timer = setInterval(() => dealRepository.simulateTeammateUpdate(), interval)
    return () => clearInterval(timer)
  }, [enabled, disabled, interval])

  function sendUpdate(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const update = dealRepository.simulateTeammateUpdate({ dealId: String(form.get('dealId')).trim().toUpperCase(), stageId: form.get('stageId'), ownerId: form.get('ownerId') })
      setMessage(`${update.actor.name} set ${update.deal.id} to ${stageNames[update.deal.stageId]}.`)
      setError('')
    } catch (failure) {
      setError(failure.message)
      setMessage('')
    }
  }

  return (
    <details className="network-simulator teammate-simulator">
      <summary>Teammate simulator <span>{enabled ? 'Automatic activity on' : 'Automatic activity off'} · {activity.teamCount.toLocaleString('en-US')} updates received</span></summary>
      <div className="teammate-settings">
        <label className="teammate-toggle"><input type="checkbox" checked={enabled} disabled={disabled} onChange={(event) => setEnabled(event.target.checked)} />Enable automatic teammate updates</label>
        <label className="teammate-interval">Update every <select aria-label="Update every" value={interval} onChange={(event) => setIntervalMs(Number(event.target.value))}><option value="1000">1 second</option><option value="3000">3 seconds</option><option value="5000">5 seconds</option></select></label>
        <p>Automatic activity updates random deals. Use the controls below to reproduce an edit on a specific deal.</p>
      </div>
      <form onSubmit={sendUpdate}>
        <label>Deal ID<input name="dealId" defaultValue="D-00001" placeholder="D-00001" required /></label>
        <label>Teammate<select aria-label="Teammate" name="ownerId" defaultValue="owner-2">{OWNERS.slice(1).map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
        <label>Teammate stage<select aria-label="Teammate stage" name="stageId" defaultValue="contacted">{STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>
        <button type="submit" className="primary-button" disabled={disabled}>Send teammate update</button>
        <p className="teammate-message" role={error ? 'alert' : 'status'}>{error || message || 'Manual teammate edits apply immediately to the simulated server.'}</p>
        <div className="teammate-activity" aria-label="Recent teammate activity">
          {activity.activities.length ? activity.activities.map((update) => <p key={update.eventId}>{update.actor?.name || 'A teammate'} set <strong>{update.deal.id}</strong> to {stageNames[update.deal.stageId]}.</p>) : <p>No teammate updates yet.</p>}
        </div>
      </form>
    </details>
  )
}
