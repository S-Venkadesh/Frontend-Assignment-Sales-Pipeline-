import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { dealRepository } from '../data/dealRepository.js'
import { SaveController } from '../state/saveController.js'

const DEALS_KEY = ['deals']
const controllers = new WeakMap()

export function useDeals() {
  const queryClient = useQueryClient()
  let controller = controllers.get(queryClient)
  if (!controller) {
    controller = new SaveController({ onDealsChange: (deals) => queryClient.setQueryData(DEALS_KEY, deals) })
    controllers.set(queryClient, controller)
  }
  const saves = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const query = useQuery({
    queryKey: DEALS_KEY,
    queryFn: async () => controller.initialize(await dealRepository.getDeals()),
    staleTime: Infinity,
  })
  const mutation = useMutation({
    mutationFn: dealRepository.saveStages,
    retry: false,
    gcTime: 10000,
    onSuccess: (response, operation) => controller.settle(operation, response.results),
    onError: (error, operation) => controller.fail(operation, error),
  })

  function changeStages(dealIds, stageId) {
    const operation = controller.begin(dealIds, stageId)
    if (operation.items.length) mutation.mutate(operation)
    return { requestedIds: operation.items.map((item) => item.id), unchangedIds: operation.unchangedIds }
  }

  function retryFailed(ids) {
    const byStage = new Map()
    for (const item of controller.retryItems(ids)) {
      if (!byStage.has(item.stageId)) byStage.set(item.stageId, [])
      byStage.get(item.stageId).push(item.id)
    }
    for (const [stageId, dealIds] of byStage) changeStages(dealIds, stageId)
  }

  return {
    ...query, saves, changeStages,
    changeStage: (dealId, stageId) => changeStages([dealId], stageId),
    retryFailed,
    discardFailed: (ids) => controller.discard(ids),
  }
}
