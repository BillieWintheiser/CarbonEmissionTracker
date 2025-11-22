import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/wagmi';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, CheckCircle2 } from 'lucide-react';

export function CompanyRegistration({ onSuccess }) {
  const [companyName, setCompanyName] = React.useState('');
  const { address } = useAccount();
  const { toast } = useToast();

  const { data: hash, isPending, writeContract, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  React.useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Success!",
        description: "Company registered successfully. Awaiting verification.",
      });
      setCompanyName('');
      if (onSuccess) onSuccess();
    }
  }, [isSuccess, onSuccess, toast]);

  React.useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to register company",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!companyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a company name",
        variant: "destructive",
      });
      return;
    }

    if (!address) {
      toast({
        title: "Error",
        description: "Please connect your wallet",
        variant: "destructive",
      });
      return;
    }

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'registerCompany',
      args: [companyName],
    });
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Company Registration
        </CardTitle>
        <CardDescription>
          Register your company to start tracking emissions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              placeholder="Enter your company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={isPending || isConfirming}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || isConfirming || !address}
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isPending ? 'Confirming...' : 'Processing...'}
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Register Company
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
