import React from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import { config } from './config/wagmi';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StatusBar } from './components/StatusBar';
import { CompanyRegistration } from './components/CompanyRegistration';
import { EmissionReport } from './components/EmissionReport';
import { TransactionHistory } from './components/TransactionHistory';
import { CompanyList } from './components/CompanyList';
import { Toaster } from './components/ui/toaster';
import { Card, CardContent } from './components/ui/card';
import { Leaf, Shield, Lock } from 'lucide-react';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

function AppContent() {
  const [refreshKey, setRefreshKey] = React.useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <Card className="border-primary/20 bg-gradient-to-r from-card to-card/50">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                  <h1 className="text-3xl md:text-4xl font-bold text-primary flex items-center gap-3 justify-center md:justify-start mb-2">
                    <Leaf className="h-8 w-8" />
                    Carbon Emission Tracker
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                      <Lock className="h-3 w-3" />
                      FHE Protected
                    </span>
                  </h1>
                  <p className="text-muted-foreground">
                    Confidential Environmental Data Management with Fully Homomorphic Encryption
                  </p>
                </div>
                <div>
                  <ConnectButton />
                </div>
              </div>
            </CardContent>
          </Card>
        </header>

        {/* Privacy Info */}
        <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-primary mb-1">Privacy First</h3>
                <p className="text-sm text-muted-foreground">
                  All emission data is encrypted using Fully Homomorphic Encryption (FHE) from Zama.
                  Your sensitive environmental data remains private while enabling secure aggregation and compliance verification.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Bar */}
        <StatusBar key={`status-${refreshKey}`} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <CompanyRegistration onSuccess={handleRefresh} />
          <EmissionReport onSuccess={handleRefresh} />
        </div>

        {/* Transaction History */}
        <div className="mb-6">
          <TransactionHistory key={`tx-${refreshKey}`} />
        </div>

        {/* Company List */}
        <div className="mb-6">
          <CompanyList key={`companies-${refreshKey}`} />
        </div>

        {/* Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <h3 className="text-primary font-semibold mb-2 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Privacy Protection
              </h3>
              <p className="text-sm text-muted-foreground">
                All emission data is encrypted using Zama's FHE technology, ensuring complete confidentiality while maintaining verifiability.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <h3 className="text-primary font-semibold mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Compliance Ready
              </h3>
              <p className="text-sm text-muted-foreground">
                Automated reporting periods and verification workflows support regulatory compliance requirements.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <h3 className="text-primary font-semibold mb-2 flex items-center gap-2">
                <Leaf className="h-4 w-4" />
                Environmental Impact
              </h3>
              <p className="text-sm text-muted-foreground">
                Track Scope 1, 2, and 3 emissions with energy consumption metrics for comprehensive carbon footprint analysis.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <h3 className="text-primary font-semibold mb-2">
                Multi-Stakeholder
              </h3>
              <p className="text-sm text-muted-foreground">
                Secure data sharing between companies, verifiers, and regulators without compromising sensitive information.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-muted-foreground">
          <p>Building a sustainable future through privacy-preserving technology</p>
        </footer>
      </div>

      <Toaster />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <AppContent />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
}

export default App;
