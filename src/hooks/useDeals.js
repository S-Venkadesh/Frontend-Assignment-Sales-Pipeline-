import { useQuery, useQueryClient } from '@tanstack/react-query'
import { changeDealStage, changeDealStages, getDeals } from '../data/dealRepository.js'

const DEALS_KEY = ['deals']

export function useDeals() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: DEALS_KEY, queryFn: getDeals, staleTime: Infinity })
  function changeStage(dealId, stageId) {
    queryClient.setQueryData(DEALS_KEY, changeDealStage(dealId, stageId))
  }
  function changeStages(dealIds, stageId) {
    const result = changeDealStages(dealIds, stageId)
    queryClient.setQueryData(DEALS_KEY, result.deals)
    return result
  }
  return { ...query, changeStage, changeStages }
}
