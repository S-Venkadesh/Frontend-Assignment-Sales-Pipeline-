import { useMemo } from 'react'
import { capturePipelineView, projectPipelineView } from '../data/pipelineView.js'

export function usePipelineView(deals, filters, now, viewRevision, teamRevision, refreshKey) {
  // Deliberately capture a new ordering only for explicit view/local-edit changes.
  // Team events patch record values without resnapshotting IDs or sort positions.
  const view = useMemo(
    () => capturePipelineView(deals, filters, now, teamRevision),
    [filters.search, filters.ownerId, filters.stageId, filters.inactivity, filters.sort, now, viewRevision, refreshKey],
  )
  const byId = useMemo(() => new Map(deals.map((deal) => [deal.id, deal])), [deals])
  const matching = useMemo(() => projectPipelineView(view, byId), [view, byId])
  return { matching, hasUpdates: teamRevision > view.teamRevision }
}
