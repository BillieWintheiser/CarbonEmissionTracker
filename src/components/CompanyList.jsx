import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useReadContract, useBlockNumber } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/wagmi';
import { Loader2, Building2, CheckCircle2, Clock } from 'lucide-react';
import { shortenAddress } from '@/lib/utils';

export function CompanyList() {
  const [companies, setCompanies] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const { data: blockNumber } = useBlockNumber({ watch: true });

  const { data: registeredCompanies, refetch: refetchCompanies } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getRegisteredCompanies',
  });

  React.useEffect(() => {
    const fetchCompanyDetails = async () => {
      if (!registeredCompanies || registeredCompanies.length === 0) {
        setCompanies([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const companyDetails = [];

      for (const companyAddress of registeredCompanies) {
        try {
          const response = await fetch(
            window.ethereum ?
            (await window.ethereum.request({
              method: 'eth_call',
              params: [{
                to: CONTRACT_ADDRESS,
                data: '0x' + 'b1a1a882' + companyAddress.substring(2).padStart(64, '0')
              }, 'latest']
            })) : null
          );

          // Simplified: In production, properly decode the response
          companyDetails.push({
            address: companyAddress,
            name: 'Company',
            isVerified: false,
          });
        } catch (error) {
          console.error(`Error fetching company ${companyAddress}:`, error);
        }
      }

      setCompanies(companyDetails);
      setIsLoading(false);
    };

    fetchCompanyDetails();
  }, [registeredCompanies]);

  React.useEffect(() => {
    if (blockNumber) {
      refetchCompanies();
    }
  }, [blockNumber, refetchCompanies]);

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Registered Companies
        </CardTitle>
        <CardDescription>
          View all companies registered on the platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No companies registered yet
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {companies.map((company, index) => (
              <div
                key={company.address}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium">{company.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {shortenAddress(company.address)}
                  </div>
                </div>
                <div>
                  {company.isVerified ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500">
                      <Clock className="h-3 w-3" />
                      Pending
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
