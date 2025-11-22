# Deployment Guide

## Security Audit & Performance Optimization Implementation

This project includes comprehensive security auditing and performance optimization tools.

### Complete Tool Stack

```
Development Pipeline:
  Hardhat + solhint + gas-reporter + optimizer
     ↓
  Frontend + eslint + prettier + husky
     ↓
  CI/CD + security-check + performance-test
```

## Security Features

### 1. ESLint (Frontend Security)
- **Purpose**: Static code analysis for JavaScript/React
- **Benefits**: 
  - Prevents common security vulnerabilities
  - Enforces secure coding patterns
  - Detects potential XSS, injection attacks
  
**Usage**:
```bash
npm run lint:frontend        # Check for issues
npm run lint:fix             # Auto-fix issues
```

### 2. Solhint (Smart Contract Security)
- **Purpose**: Solidity linter for security best practices
- **Benefits**:
  - Detects reentrancy vulnerabilities
  - Checks for DoS attack vectors
  - Validates gas optimization patterns
  - Enforces security standards

**Usage**:
```bash
npm run lint:sol             # Lint Solidity contracts
```

### 3. Hardhat Gas Reporter
- **Purpose**: Monitor and optimize gas costs
- **Benefits**:
  - Track gas usage per function
  - Identify expensive operations
  - DoS prevention through gas optimization
  - Cost reduction

**Usage**:
```bash
npm run test:gas             # Run tests with gas reporting
```

### 4. Prettier (Code Formatting)
- **Purpose**: Consistent code formatting
- **Benefits**:
  - Improved code readability
  - Reduced attack surface through consistency
  - Team collaboration efficiency

**Usage**:
```bash
npm run format               # Format all files
npm run format:check         # Check formatting
```

## Performance Optimization

### 1. Code Splitting
- **Implementation**: Vite automatic code splitting
- **Benefits**:
  - Reduced initial load time
  - Smaller attack surface per chunk
  - Better caching strategy

**Configuration**: `vite.config.js`
```javascript
rollupOptions: {
  output: {
    manualChunks: {
      vendor: ['react', 'react-dom'],
      wagmi: ['wagmi', 'viem', '@rainbow-me/rainbowkit'],
      ui: ['@radix-ui/...']
    }
  }
}
```

### 2. ESBuild Optimization
- **Purpose**: Fast TypeScript/JavaScript compilation
- **Benefits**:
  - 10-100x faster than traditional bundlers
  - Type safety when enabled
  - Tree shaking for smaller bundles

### 3. Solidity Optimizer
- **Purpose**: Bytecode optimization
- **Benefits**:
  - Reduced deployment costs
  - Lower transaction gas costs
  - Security-performance trade-offs managed

**Configuration**: `hardhat.config.js`
```javascript
solidity: {
  version: "0.8.24",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
}
```

## CI/CD Automation

### GitHub Actions Workflow

**File**: `.github/workflows/ci.yml`

**Pipeline Stages**:

1. **Security Audit**
   - npm audit (dependency vulnerabilities)
   - Solidity linting (smart contract security)
   
2. **Code Quality**
   - ESLint checks
   - Prettier formatting validation
   
3. **Smart Contract Tests**
   - Contract compilation
   - Unit tests with gas reporting
   
4. **Build & Performance**
   - Production build
   - Bundle size analysis
   - Artifact upload

**Usage**:
```bash
# Triggered automatically on:
- Push to main/develop
- Pull requests to main/develop

# Manual security check:
npm run security:check

# Manual performance test:
npm run performance:test
```

## Pre-commit Hooks (Husky)

### Left-Shift Strategy

**Purpose**: Catch issues before they reach the repository

**File**: `.husky/pre-commit`

**Automated Checks**:
- Lint staged files
- Run security checks
- Format code automatically

**Setup**:
```bash
# Install Husky (automatic via npm install)
npm install

# Manual Husky install if needed
npm run prepare
```

### Lint-Staged Configuration

**File**: `.lintstagedrc.json`

Automatically runs on staged files:
- ESLint fix for JS/JSX
- Prettier formatting
- Solhint for Solidity contracts

## Environment Configuration

### .env.example Structure

```bash
# Network Configuration
VITE_NETWORK_ID=8009
VITE_RPC_URL=https://devnet.zama.ai

# Contract Configuration
VITE_CONTRACT_ADDRESS=0x80C36125008d8643b8B59c2ddfE3C2E3Ec98a7B2

# Pauser Set Configuration (IMPORTANT)
PAUSER_ADDRESSES=0x1234...,0x2345...

# KMS Configuration
KMS_GENERATION=1

# Security
ENABLE_SECURITY_CHECKS=true
ENABLE_GAS_OPTIMIZATION=true

# Performance
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_BUDGET_KB=500
```

## Deployment Checklist

### Pre-Deployment

- [ ] Run security audit: `npm run security:check`
- [ ] Check code quality: `npm run lint`
- [ ] Format code: `npm run format`
- [ ] Test contracts: `npm run test:gas`
- [ ] Build frontend: `npm run build`
- [ ] Verify bundle size: `du -sh dist`
- [ ] Review .env configuration
- [ ] Update PAUSER_ADDRESSES
- [ ] Verify KMS_GENERATION

### Deployment

```bash
# 1. Build optimized production bundle
npm run build

# 2. Deploy to Vercel
vercel --prod

# 3. Deploy smart contracts (if needed)
npm run deploy:sepolia
# or
npm run deploy:zama
```

### Post-Deployment

- [ ] Verify contract on block explorer
- [ ] Test all critical functions
- [ ] Monitor gas costs
- [ ] Check bundle performance
- [ ] Verify security headers
- [ ] Enable performance monitoring

## Performance Metrics

### Target Metrics

- **Bundle Size**: < 500 KB (gzipped)
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Gas Costs**: Optimized per function

### Current Build Stats

```bash
# Check build size
npm run build
du -sh dist

# Analyze bundle
npm run analyze
```

## Security Best Practices

### Frontend Security

1. **Input Validation**
   - All user inputs validated
   - React hooks prevent injection

2. **XSS Prevention**
   - React auto-escaping
   - No dangerouslySetInnerHTML

3. **CSRF Protection**
   - Web3 signature verification
   - Nonce-based transactions

### Smart Contract Security

1. **Access Control**
   - Role-based permissions
   - Modifier guards on all state changes

2. **Reentrancy Protection**
   - Checks-Effects-Interactions pattern
   - ReentrancyGuard where needed

3. **Gas Optimization**
   - Efficient data structures
   - Batch operations where possible

## Monitoring & Maintenance

### Regular Tasks

**Weekly**:
- Review npm audit results
- Check dependency updates
- Monitor gas costs

**Monthly**:
- Full security audit
- Performance benchmarking
- Bundle size optimization

**Per Release**:
- Complete test suite
- Security checklist
- Performance validation

## Troubleshooting

### Build Issues

```bash
# Clear cache and rebuild
npm run clean
npm install
npm run build
```

### Linting Errors

```bash
# Auto-fix most issues
npm run lint:fix
npm run format
```

### Gas Optimization

```bash
# Analyze gas usage
npm run test:gas

# Review gas-reporter output
# Optimize high-cost functions
```

## Resources

- [ESLint Documentation](https://eslint.org/)
- [Solhint Rules](https://github.com/protofire/solhint)
- [Hardhat Gas Reporter](https://github.com/cgewecke/hardhat-gas-reporter)
- [Husky Git Hooks](https://typicode.github.io/husky/)
- [Vite Performance](https://vitejs.dev/guide/performance.html)

---

**Security + Performance = Production Ready** ✅
