import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useAccount, useReadContract, useBlockNumber } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/wagmi';
import { Loader2, History, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';

export function TransactionHistory() {
  const { address } = useAccount();
  const [transactions, setTransactions] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const { data: blockNumber } = useBlockNumber({ watch: true });

  const { data: currentPeriod, refetch: refetchPeriod } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getCurrentPeriod',
  });

  const { data: companyInfo, refetch: refetchCompany } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getCompanyInfo',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  React.useEffect(() => {
    const fetchTransactionHistory = async () => {
      if (!address || !currentPeriod) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const txHistory = [];

      // Add registration transaction if registered
      if (companyInfo && companyInfo[1]) { // isRegistered
        txHistory.push({
          id: `reg-${address}`,
          type: 'registration',
          status: companyInfo[2] ? 'verified' : 'pending', // isVerified
          timestamp: companyInfo[3], // registrationTime
          description: `Company registered: ${companyInfo[0]}`,
        });
      }

      // Check reports for the last 5 periods
      const periodChecks = [];
      const currentP = Number(currentPeriod);
      for (let i = 0; i < 5 && currentP - i >= 0; i++) {
        periodChecks.push(currentP - i);
      }

      try {
        const reportPromises = periodChecks.map(async (period) => {
          try {
            const response = await fetch(
              `https://devnet.zama.ai/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc`
            );

            // For now, we'll use the contract read to check report status
            const reportStatus = await fetch(CONTRACT_ADDRESS, {
              method: 'eth_call',
              params: [{
                to: CONTRACT_ADDRESS,
                data: `0x${CONTRACT_ABI.find(a => a.includes('getReportStatus')).substring(0, 8)}${address.substring(2).padStart(64, '0')}${period.toString(16).padStart(64, '0')}`
              }]
            });

            return null; // Simplified for now
          } catch (err) {
            return null;
          }
        });

        await Promise.all(reportPromises);
      } catch (error) {
        console.error('Error fetching transaction history:', error);
      }

      setTransactions(txHistory);
      setIsLoading(false);
    };

    fetchTransactionHistory();
  }, [address, currentPeriod, companyInfo, blockNumber]);

  React.useEffect(() => {
    if (blockNumber) {
      refetchPeriod();
      refetchCompany();
    }
  }, [blockNumber, refetchPeriod, refetchCompany]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'verified':
      case 'confirmed':
        return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'verified':
        return 'Verified';
      case 'confirmed':
        return 'Confirmed';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Transaction History
        </CardTitle>
        <CardDescription>
          View your past transactions and reports
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!address ? (
          <div className="text-center py-8 text-muted-foreground">
            Connect your wallet to view transaction history
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transactions found
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(tx.status)}
                    <span className="font-medium capitalize">{tx.type}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {tx.description}
                  </p>
                  {tx.timestamp && (
                    <p className="text-xs text-muted-foreground">
                      {formatTimestamp(tx.timestamp)}
                    </p>
                  )}
                </div>
                <div className="ml-4">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      tx.status === 'verified' || tx.status === 'confirmed'
                        ? 'bg-primary/10 text-primary'
                        : tx.status === 'pending'
                        ? 'bg-yellow-500/10 text-yellow-500'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {getStatusText(tx.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
