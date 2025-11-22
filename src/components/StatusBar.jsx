import React from 'react';
import { Card, CardContent } from './ui/card';
import { useAccount, useReadContract, useBlockNumber } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/wagmi';
import { Loader2, Activity, Building2, Network } from 'lucide-react';
import { shortenAddress } from '@/lib/utils';

export function StatusBar() {
  const { address, isConnected, chain } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const { data: currentPeriod, isLoading: isPeriodLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getCurrentPeriod',
    query: {
      refetchInterval: 10000,
    },
  });

  const { data: totalCompanies, isLoading: isCompaniesLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTotalCompanies',
    query: {
      refetchInterval: 10000,
    },
  });

  const StatusItem = ({ icon: Icon, label, value, isLoading }) => (
    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-card/50 border border-primary/10">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-sm font-medium text-foreground">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          value || '-'
        )}
      </div>
    </div>
  );

  return (
    <Card className="border-primary/20 mb-6">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusItem
            icon={Activity}
            label="Current Period"
            value={currentPeriod?.toString()}
            isLoading={isPeriodLoading}
          />
          <StatusItem
            icon={Building2}
            label="Total Companies"
            value={totalCompanies?.toString()}
            isLoading={isCompaniesLoading}
          />
          <StatusItem
            icon={Network}
            label="Network"
            value={isConnected ? chain?.name : 'Disconnected'}
            isLoading={false}
          />
          <StatusItem
            icon={Building2}
            label="Account"
            value={isConnected && address ? shortenAddress(address) : 'Not Connected'}
            isLoading={false}
          />
        </div>
      </CardContent>
    </Card>
  );
}
