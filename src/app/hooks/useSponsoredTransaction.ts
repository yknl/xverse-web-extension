import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSponsorInfo, sponsorTransaction } from '@secretkeylabs/xverse-core/api';
import { StacksTransaction } from '@secretkeylabs/xverse-core';

export const useSponsorInfoQuery = (sponsorUrl?: string) =>
  useQuery({
    queryKey: ['sponsorInfo'],
    queryFn: async () => {
      try {
        return await getSponsorInfo(sponsorUrl);
      } catch (e: any) {
        return Promise.reject(e);
      }
    },
  });

export const useSponsoredTransaction = (isSponsorOptionSelected: boolean, sponsorUrl?: string) => {
  const [isServiceRunning, setIsServiceRunning] = useState(false);

  const { error, data: isActive, isLoading } = useSponsorInfoQuery(sponsorUrl);

  useEffect(() => {
    if (!isLoading && !error) {
      setIsServiceRunning(!!isActive);
    }
  }, [isActive, error, isLoading]);

  const sponsorTransactionToUrl = async (signed: StacksTransaction) =>
    sponsorTransaction(signed, sponsorUrl);

  return {
    isSponsored: isServiceRunning && isSponsorOptionSelected,
    isServiceRunning,
    sponsorTransaction: sponsorTransactionToUrl,
  };
};

export default useSponsoredTransaction;
