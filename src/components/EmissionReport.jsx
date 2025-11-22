import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/wagmi';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Leaf, Send } from 'lucide-react';

export function EmissionReport({ onSuccess }) {
  const [formData, setFormData] = React.useState({
    directEmissions: '',
    indirectEmissions: '',
    supplyChainEmissions: '',
    energyConsumption: '',
  });

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
        description: "Emission report submitted successfully. Data is now encrypted on-chain.",
      });
      setFormData({
        directEmissions: '',
        indirectEmissions: '',
        supplyChainEmissions: '',
        energyConsumption: '',
      });
      if (onSuccess) onSuccess();
    }
  }, [isSuccess, onSuccess, toast]);

  React.useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit emission report",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { directEmissions, indirectEmissions, supplyChainEmissions, energyConsumption } = formData;

    if (!directEmissions || !indirectEmissions || !supplyChainEmissions || !energyConsumption) {
      toast({
        title: "Error",
        description: "Please fill in all emission data fields",
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
      functionName: 'submitEmissionReport',
      args: [
        parseInt(directEmissions),
        parseInt(indirectEmissions),
        parseInt(supplyChainEmissions),
        parseInt(energyConsumption),
      ],
    });
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Leaf className="h-5 w-5" />
          Emission Report Submission
        </CardTitle>
        <CardDescription>
          Submit your encrypted carbon emission data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="directEmissions">Direct Emissions (Scope 1)</Label>
              <Input
                id="directEmissions"
                type="number"
                min="0"
                placeholder="Tons CO2"
                value={formData.directEmissions}
                onChange={(e) => handleInputChange('directEmissions', e.target.value)}
                disabled={isPending || isConfirming}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="indirectEmissions">Indirect Emissions (Scope 2)</Label>
              <Input
                id="indirectEmissions"
                type="number"
                min="0"
                placeholder="Tons CO2"
                value={formData.indirectEmissions}
                onChange={(e) => handleInputChange('indirectEmissions', e.target.value)}
                disabled={isPending || isConfirming}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplyChainEmissions">Supply Chain (Scope 3)</Label>
              <Input
                id="supplyChainEmissions"
                type="number"
                min="0"
                placeholder="Tons CO2"
                value={formData.supplyChainEmissions}
                onChange={(e) => handleInputChange('supplyChainEmissions', e.target.value)}
                disabled={isPending || isConfirming}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="energyConsumption">Energy Consumption</Label>
              <Input
                id="energyConsumption"
                type="number"
                min="0"
                placeholder="kWh"
                value={formData.energyConsumption}
                onChange={(e) => handleInputChange('energyConsumption', e.target.value)}
                disabled={isPending || isConfirming}
              />
            </div>
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
                <Send className="mr-2 h-4 w-4" />
                Submit Encrypted Report
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
