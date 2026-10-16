import { useQuery, useQueryClient } from '@tanstack/react-query'
import { changeDealStage, getDeals } from '../data/dealRepository.js'

const DEALS_KEY = ['deals']

export function useDeals() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: DEALS_KEY, queryFn: getDeals, staleTime: Infinity })
  function changeStage(dealId, stageId) {
    queryClient.setQueryData(DEALS_KEY, changeDealStage(dealId, stageId))
  }
  return { ...query, changeStage }
}
