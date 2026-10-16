export const STAGES = [
  { id: 'new-lead', label: 'New Lead', color: 'slate', count: 10000 },
  { id: 'contacted', label: 'Contacted', color: 'blue', count: 9000 },
  { id: 'demo-done', label: 'Demo Done', color: 'purple', count: 8000 },
  { id: 'proposal-sent', label: 'Proposal Sent', color: 'amber', count: 7000 },
  { id: 'negotiation', label: 'Negotiation', color: 'orange', count: 6000 },
  { id: 'won', label: 'Won', color: 'green', count: 6500 },
  { id: 'lost', label: 'Lost', color: 'red', count: 3500 },
]

export const OWNERS = [
  'Alex Morgan', 'Priya Sharma', 'James Chen', 'Sofia Rivera', 'Noah Williams',
  'Aisha Patel', 'Oliver Brooks', 'Emma Wilson', 'Liam Carter', 'Maya Singh',
  'Ethan Park', 'Isabella Rossi', 'Lucas Martin', 'Zara Ahmed', 'Daniel Kim',
  'Chloe Taylor', 'Arjun Mehta', 'Grace Lee', 'Leo Anderson', 'Amelia Scott',
].map((name, index) => ({
  id: `owner-${index + 1}`, name,
  initials: name.split(' ').map((part) => part[0]).join(''),
  color: ['purple', 'blue', 'green', 'amber', 'orange'][index % 5],
}))

const COMPANIES = ['Northstar', 'Acme', 'Meridian', 'Evergreen', 'Atlas', 'Vertex', 'Summit', 'Brightside', 'Horizon', 'Cobalt', 'Pioneer', 'Lumina', 'Oakwood', 'Nexus', 'Clearwater', 'Redwood', 'Beacon', 'Orbit', 'Silverline', 'Westbridge']
const INDUSTRIES = ['Technologies', 'Health', 'Logistics', 'Financial', 'Retail', 'Systems', 'Labs', 'Energy']
const PROJECTS = ['Enterprise rollout', 'Annual renewal', 'Platform expansion', 'Team onboarding', 'Regional launch', 'Security upgrade', 'Analytics suite', 'Growth plan']
const DAY_MS = 86400000

export function daysSince(timestamp, now = Date.now()) {
  return Math.max(0, Math.floor((now - Date.parse(timestamp)) / DAY_MS))
}

// A fixed seed and explicit reference date make datasets reproducible in tests.
export function createDeals({ count = 50000, seed = 42, now = Date.now() } = {}) {
  let state = seed >>> 0
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
  const totalSlots = STAGES.reduce((total, stage) => total + stage.count, 0)
  return Array.from({ length: count }, (_, index) => {
    let slot = (index * 7919) % totalSlots
    const stage = STAGES.find((item) => {
      if (slot < item.count) return true
      slot -= item.count
      return false
    })
    const company = `${COMPANIES[Math.floor(random() * COMPANIES.length)]} ${INDUSTRIES[Math.floor(random() * INDUSTRIES.length)]}`
    const name = PROJECTS[Math.floor(random() * PROJECTS.length)]
    const ownerId = OWNERS[Math.floor(random() * OWNERS.length)].id
    const valueCents = (1500 + Math.floor(random() * 985) * 100) * 100
    const lastActivityAt = new Date(now - Math.floor(random() * 61) * DAY_MS).toISOString()
    return {
      id: `D-${String(index + 1).padStart(5, '0')}`, name, company,
      valueCents, currency: 'USD', ownerId, stageId: stage.id,
      lastActivityAt, updatedAt: lastActivityAt, version: 1,
    }
  })
}

export function updateStage(deals, dealId, stageId, now = Date.now()) {
  if (!STAGES.some((stage) => stage.id === stageId)) throw new Error('Unknown stage')
  const index = deals.findIndex((deal) => deal.id === dealId)
  if (index === -1) throw new Error('Deal not found')
  if (deals[index].stageId === stageId) return deals
  const updated = deals.slice()
  const timestamp = new Date(now).toISOString()
  updated[index] = {
    ...deals[index], stageId, updatedAt: timestamp, lastActivityAt: timestamp,
    version: deals[index].version + 1,
  }
  return updated
}

// One dataset pass, rather than copying/scanning 50,000 deals per selected ID.
// Local changes are atomic; per-deal network outcomes belong to the next increment.
export function updateStages(deals, dealIds, stageId, now = Date.now()) {
  if (!STAGES.some((stage) => stage.id === stageId)) throw new Error('Unknown stage')
  const remainingIds = new Set(dealIds)
  const changedIds = []
  const unchangedIds = []
  if (!remainingIds.size) return { deals, changedIds, unchangedIds }
  const timestamp = new Date(now).toISOString()
  const updated = deals.map((deal) => {
    if (!remainingIds.delete(deal.id)) return deal
    if (deal.stageId === stageId) {
      unchangedIds.push(deal.id)
      return deal
    }
    changedIds.push(deal.id)
    return { ...deal, stageId, updatedAt: timestamp, lastActivityAt: timestamp, version: deal.version + 1 }
  })
  if (remainingIds.size) throw new Error('Deal not found')
  return { deals: changedIds.length ? updated : deals, changedIds, unchangedIds }
}

export function filterDeals(deals, { search = '', ownerId = '', stageId = '', inactivity = '', sort = 'recent' } = {}, now = Date.now()) {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matching = deals.filter((deal) => {
    if (ownerId && deal.ownerId !== ownerId) return false
    if (stageId && deal.stageId !== stageId) return false
    if (inactivity && daysSince(deal.lastActivityAt, now) < Number(inactivity)) return false
    const text = `${deal.id} ${deal.name} ${deal.company}`.toLowerCase()
    return terms.every((term) => text.includes(term))
  })
  return matching.sort((a, b) => {
    if (sort === 'value-desc') return b.valueCents - a.valueCents || a.id.localeCompare(b.id)
    if (sort === 'value-asc') return a.valueCents - b.valueCents || a.id.localeCompare(b.id)
    if (sort === 'company') return a.company.localeCompare(b.company) || a.id.localeCompare(b.id)
    return b.lastActivityAt.localeCompare(a.lastActivityAt) || a.id.localeCompare(b.id)
  })
}
