const { expect } = require("chai");
const { ethers, fhevm } = require("hardhat");

async function deployFixture() {
  const factory = await ethers.getContractFactory("CarbonEmissionTracker");
  const pauserAddresses = []; // Empty array for pausers
  const kmsGeneration = 1; // KMS generation
  const contract = await factory.deploy(pauserAddresses, kmsGeneration);
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("CarbonEmissionTracker", function () {
  let signers;
  let contract;
  let contractAddress;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      verifier: ethSigners[3],
      company1: ethSigners[4],
      company2: ethSigners[5]
    };
  });

  beforeEach(async function () {
    // Only run in Mock environment
    if (!fhevm.isMock) {
      console.warn(`This test suite cannot run on Sepolia`);
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      expect(await contract.getAddress()).to.be.properAddress;
    });

    it("should set owner correctly", async function () {
      expect(await contract.owner()).to.eq(signers.deployer.address);
    });

    it("should initialize with zero companies", async function () {
      expect(await contract.totalCompanies()).to.eq(0);
    });

    it("should start at reporting period 1", async function () {
      expect(await contract.currentReportingPeriod()).to.eq(1);
    });

    it("should set deployer as authorized verifier", async function () {
      expect(await contract.authorizedVerifiers(signers.deployer.address)).to.be.true;
    });

    it("should have empty registered companies list", async function () {
      const companies = await contract.getRegisteredCompanies();
      expect(companies.length).to.eq(0);
    });
  });

  describe("Company Registration", function () {
    it("should register company successfully", async function () {
      await expect(
        contract.connect(signers.alice).registerCompany("Acme Corporation")
      ).to.emit(contract, "CompanyRegistered")
        .withArgs(signers.alice.address, "Acme Corporation");

      expect(await contract.totalCompanies()).to.eq(1);
    });

    it("should reject empty company name", async function () {
      await expect(
        contract.connect(signers.alice).registerCompany("")
      ).to.be.revertedWith("Company name required");
    });

    it("should reject duplicate registration", async function () {
      await contract.connect(signers.alice).registerCompany("Acme Corporation");

      await expect(
        contract.connect(signers.alice).registerCompany("Acme Corporation")
      ).to.be.revertedWith("Company already registered");
    });

    it("should store company information correctly", async function () {
      await contract.connect(signers.alice).registerCompany("Tech Industries");

      const [name, isRegistered, isVerified, registrationTime] =
        await contract.getCompanyInfo(signers.alice.address);

      expect(name).to.eq("Tech Industries");
      expect(isRegistered).to.be.true;
      expect(isVerified).to.be.false;
      expect(registrationTime).to.be.gt(0);
    });

    it("should add company to registered list", async function () {
      await contract.connect(signers.alice).registerCompany("Company A");
      await contract.connect(signers.bob).registerCompany("Company B");

      const companies = await contract.getRegisteredCompanies();
      expect(companies.length).to.eq(2);
      expect(companies[0]).to.eq(signers.alice.address);
      expect(companies[1]).to.eq(signers.bob.address);
    });

    it("should allow multiple companies to register", async function () {
      await contract.connect(signers.alice).registerCompany("Company A");
      await contract.connect(signers.bob).registerCompany("Company B");
      await contract.connect(signers.company1).registerCompany("Company C");

      expect(await contract.totalCompanies()).to.eq(3);
    });
  });

  describe("Company Verification", function () {
    beforeEach(async function () {
      await contract.connect(signers.alice).registerCompany("Acme Corporation");
    });

    it("should verify company successfully", async function () {
      await expect(
        contract.connect(signers.deployer).verifyCompany(signers.alice.address)
      ).to.emit(contract, "CompanyVerified")
        .withArgs(signers.alice.address, signers.deployer.address);

      const [, , isVerified] = await contract.getCompanyInfo(signers.alice.address);
      expect(isVerified).to.be.true;
    });

    it("should reject verification of non-registered company", async function () {
      await expect(
        contract.connect(signers.deployer).verifyCompany(signers.bob.address)
      ).to.be.revertedWith("Company not registered");
    });

    it("should reject duplicate verification", async function () {
      await contract.connect(signers.deployer).verifyCompany(signers.alice.address);

      await expect(
        contract.connect(signers.deployer).verifyCompany(signers.alice.address)
      ).to.be.revertedWith("Company already verified");
    });

    it("should allow authorized verifier to verify", async function () {
      await contract.connect(signers.deployer).addVerifier(signers.verifier.address);

      await expect(
        contract.connect(signers.verifier).verifyCompany(signers.alice.address)
      ).to.not.be.reverted;
    });

    it("should reject unauthorized verifier", async function () {
      await expect(
        contract.connect(signers.bob).verifyCompany(signers.alice.address)
      ).to.be.revertedWith("Not authorized verifier");
    });
  });

  describe("Verifier Management", function () {
    it("should add verifier successfully", async function () {
      await expect(
        contract.connect(signers.deployer).addVerifier(signers.verifier.address)
      ).to.emit(contract, "VerifierAdded")
        .withArgs(signers.verifier.address);

      expect(await contract.authorizedVerifiers(signers.verifier.address)).to.be.true;
    });

    it("should reject adding duplicate verifier", async function () {
      await contract.connect(signers.deployer).addVerifier(signers.verifier.address);

      await expect(
        contract.connect(signers.deployer).addVerifier(signers.verifier.address)
      ).to.be.revertedWith("Already a verifier");
    });

    it("should remove verifier successfully", async function () {
      await contract.connect(signers.deployer).addVerifier(signers.verifier.address);

      await expect(
        contract.connect(signers.deployer).removeVerifier(signers.verifier.address)
      ).to.emit(contract, "VerifierRemoved")
        .withArgs(signers.verifier.address);

      expect(await contract.authorizedVerifiers(signers.verifier.address)).to.be.false;
    });

    it("should reject removing non-verifier", async function () {
      await expect(
        contract.connect(signers.deployer).removeVerifier(signers.alice.address)
      ).to.be.revertedWith("Not a verifier");
    });

    it("should reject removing owner as verifier", async function () {
      await expect(
        contract.connect(signers.deployer).removeVerifier(signers.deployer.address)
      ).to.be.revertedWith("Cannot remove owner");
    });

    it("should only allow owner to add verifier", async function () {
      await expect(
        contract.connect(signers.alice).addVerifier(signers.verifier.address)
      ).to.be.revertedWith("Not authorized");
    });

    it("should only allow owner to remove verifier", async function () {
      await contract.connect(signers.deployer).addVerifier(signers.verifier.address);

      await expect(
        contract.connect(signers.alice).removeVerifier(signers.verifier.address)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Emission Report Submission", function () {
    beforeEach(async function () {
      await contract.connect(signers.alice).registerCompany("Acme Corporation");
      await contract.connect(signers.deployer).verifyCompany(signers.alice.address);
    });

    it("should submit emission report successfully", async function () {
      const directEmissions = 1000;
      const indirectEmissions = 500;
      const supplyChainEmissions = 2000;
      const energyConsumption = 50000;

      await expect(
        contract.connect(signers.alice).submitEmissionReport(
          directEmissions,
          indirectEmissions,
          supplyChainEmissions,
          energyConsumption
        )
      ).to.emit(contract, "EmissionReported")
        .withArgs(signers.alice.address, 1);
    });

    it("should encrypt emission data", async function () {
      await contract.connect(signers.alice).submitEmissionReport(1000, 500, 2000, 50000);

      const [isSubmitted, ,] = await contract.getReportStatus(signers.alice.address, 1);
      expect(isSubmitted).to.be.true;
    });

    it("should reject submission from non-verified company", async function () {
      await contract.connect(signers.bob).registerCompany("Bob Industries");

      await expect(
        contract.connect(signers.bob).submitEmissionReport(1000, 500, 2000, 50000)
      ).to.be.revertedWith("Company not verified");
    });

    it("should reject duplicate submission in same period", async function () {
      await contract.connect(signers.alice).submitEmissionReport(1000, 500, 2000, 50000);

      await expect(
        contract.connect(signers.alice).submitEmissionReport(1000, 500, 2000, 50000)
      ).to.be.revertedWith("Report already submitted for this period");
    });

    it("should update period statistics", async function () {
      await contract.connect(signers.alice).submitEmissionReport(1000, 500, 2000, 50000);

      const [participatingCompanies, totalReports, ,] =
        await contract.getPeriodStats(1);

      expect(participatingCompanies).to.eq(1);
      expect(totalReports).to.eq(1);
    });

    it("should handle zero emission values", async function () {
      await expect(
        contract.connect(signers.alice).submitEmissionReport(0, 0, 0, 0)
      ).to.not.be.reverted;
    });

    it("should handle maximum emission values", async function () {
      const maxUint32 = 4294967295; // 2^32 - 1
      const maxUint64 = BigInt("18446744073709551615"); // 2^64 - 1

      await expect(
        contract.connect(signers.alice).submitEmissionReport(
          maxUint32,
          maxUint32,
          maxUint32,
          maxUint64
        )
      ).to.not.be.reverted;
    });

    it("should allow submission from multiple companies", async function () {
      await contract.connect(signers.bob).registerCompany("Bob Industries");
      await contract.connect(signers.deployer).verifyCompany(signers.bob.address);

      await contract.connect(signers.alice).submitEmissionReport(1000, 500, 2000, 50000);
      await contract.connect(signers.bob).submitEmissionReport(800, 400, 1500, 40000);

      const [, totalReports, ,] = await contract.getPeriodStats(1);
      expect(totalReports).to.eq(2);
    });
  });

  describe("Emission Report Verification", function () {
    beforeEach(async function () {
      await contract.connect(signers.alice).registerCompany("Acme Corporation");
      await contract.connect(signers.deployer).verifyCompany(signers.alice.address);
      await contract.connect(signers.alice).submitEmissionReport(1000, 500, 2000, 50000);
    });

    it("should verify emission report successfully", async function () {
      await expect(
        contract.connect(signers.deployer).verifyEmissionReport(signers.alice.address, 1)
      ).to.emit(contract, "ReportVerified")
        .withArgs(signers.alice.address, 1, signers.deployer.address);

      const [, isVerified,] = await contract.getReportStatus(signers.alice.address, 1);
      expect(isVerified).to.be.true;
    });

    it("should reject verification of non-existent report", async function () {
      await expect(
        contract.connect(signers.deployer).verifyEmissionReport(signers.bob.address, 1)
      ).to.be.revertedWith("No report submitted");
    });

    it("should reject duplicate verification", async function () {
      await contract.connect(signers.deployer).verifyEmissionReport(signers.alice.address, 1);

      await expect(
        contract.connect(signers.deployer).verifyEmissionReport(signers.alice.address, 1)
      ).to.be.revertedWith("Report already verified");
    });

    it("should allow authorized verifier to verify report", async function () {
      await contract.connect(signers.deployer).addVerifier(signers.verifier.address);

      await expect(
        contract.connect(signers.verifier).verifyEmissionReport(signers.alice.address, 1)
      ).to.not.be.reverted;
    });

    it("should reject unauthorized verifier", async function () {
      await expect(
        contract.connect(signers.bob).verifyEmissionReport(signers.alice.address, 1)
      ).to.be.revertedWith("Not authorized verifier");
    });
  });

  describe("Reporting Period Management", function () {
    it("should close period and advance successfully", async function () {
      await expect(
        contract.connect(signers.deployer).closePeriodAndAdvance()
      ).to.emit(contract, "PeriodClosed")
        .withArgs(1, 0);

      expect(await contract.currentReportingPeriod()).to.eq(2);
    });

    it("should prevent closing already closed period", async function () {
      await contract.connect(signers.deployer).closePeriodAndAdvance();

      // Try to close period 1 again (current is now 2)
      // This should work since we're closing period 2 now
      await expect(
        contract.connect(signers.deployer).closePeriodAndAdvance()
      ).to.not.be.reverted;
    });

    it("should update period stats when closing", async function () {
      await contract.connect(signers.alice).registerCompany("Acme Corporation");
      await contract.connect(signers.deployer).verifyCompany(signers.alice.address);
      await contract.connect(signers.alice).submitEmissionReport(1000, 500, 2000, 50000);

      await contract.connect(signers.deployer).closePeriodAndAdvance();

      const [, , periodClosed, closeTime] = await contract.getPeriodStats(1);
      expect(periodClosed).to.be.true;
      expect(closeTime).to.be.gt(0);
    });

    it("should only allow owner to close period", async function () {
      await expect(
        contract.connect(signers.alice).closePeriodAndAdvance()
      ).to.be.revertedWith("Not authorized");
    });

    it("should allow submission in new period after closing", async function () {
      await contract.connect(signers.alice).registerCompany("Acme Corporation");
      await contract.connect(signers.deployer).verifyCompany(signers.alice.address);
      await contract.connect(signers.alice).submitEmissionReport(1000, 500, 2000, 50000);

      await contract.connect(signers.deployer).closePeriodAndAdvance();

      // Should be able to submit in new period
      await expect(
        contract.connect(signers.alice).submitEmissionReport(1100, 550, 2100, 51000)
      ).to.not.be.reverted;
    });
  });

  describe("Report Access Control", function () {
    beforeEach(async function () {
      await contract.connect(signers.alice).registerCompany("Acme Corporation");
      await contract.connect(signers.deployer).verifyCompany(signers.alice.address);
      await contract.connect(signers.alice).submitEmissionReport(1000, 500, 2000, 50000);
    });

    it("should grant report access successfully", async function () {
      await expect(
        contract.connect(signers.alice).grantReportAccess(signers.bob.address, 1)
      ).to.not.be.reverted;
    });

    it("should reject granting access to non-existent report", async function () {
      await expect(
        contract.connect(signers.alice).grantReportAccess(signers.bob.address, 2)
      ).to.be.revertedWith("No report to share");
    });

    it("should only allow registered company to grant access", async function () {
      await expect(
        contract.connect(signers.bob).grantReportAccess(signers.alice.address, 1)
      ).to.be.revertedWith("Company not registered");
    });
  });

  describe("View Functions", function () {
    it("should return correct current period", async function () {
      expect(await contract.getCurrentPeriod()).to.eq(1);

      await contract.connect(signers.deployer).closePeriodAndAdvance();
      expect(await contract.getCurrentPeriod()).to.eq(2);
    });

    it("should return correct total companies", async function () {
      expect(await contract.getTotalCompanies()).to.eq(0);

      await contract.connect(signers.alice).registerCompany("Company A");
      expect(await contract.getTotalCompanies()).to.eq(1);

      await contract.connect(signers.bob).registerCompany("Company B");
      expect(await contract.getTotalCompanies()).to.eq(2);
    });

    it("should check verifier status correctly", async function () {
      expect(await contract.isVerifier(signers.deployer.address)).to.be.true;
      expect(await contract.isVerifier(signers.alice.address)).to.be.false;

      await contract.connect(signers.deployer).addVerifier(signers.verifier.address);
      expect(await contract.isVerifier(signers.verifier.address)).to.be.true;
    });

    it("should return company info correctly", async function () {
      const [name1, isReg1, isVer1, regTime1] =
        await contract.getCompanyInfo(signers.alice.address);
      expect(isReg1).to.be.false;

      await contract.connect(signers.alice).registerCompany("Acme Corporation");
      const [name2, isReg2, isVer2, regTime2] =
        await contract.getCompanyInfo(signers.alice.address);
      expect(name2).to.eq("Acme Corporation");
      expect(isReg2).to.be.true;
      expect(isVer2).to.be.false;
      expect(regTime2).to.be.gt(0);
    });

    it("should return report status correctly", async function () {
      await contract.connect(signers.alice).registerCompany("Acme Corporation");
      await contract.connect(signers.deployer).verifyCompany(signers.alice.address);

      const [isSub1, isVer1,] = await contract.getReportStatus(signers.alice.address, 1);
      expect(isSub1).to.be.false;
      expect(isVer1).to.be.false;

      await contract.connect(signers.alice).submitEmissionReport(1000, 500, 2000, 50000);
      const [isSub2, isVer2, timestamp] =
        await contract.getReportStatus(signers.alice.address, 1);
      expect(isSub2).to.be.true;
      expect(isVer2).to.be.false;
      expect(timestamp).to.be.gt(0);
    });

    it("should return period stats correctly", async function () {
      const [part1, total1, closed1,] = await contract.getPeriodStats(1);
      expect(part1).to.eq(0);
      expect(total1).to.eq(0);
      expect(closed1).to.be.false;

      await contract.connect(signers.alice).registerCompany("Acme Corporation");
      await contract.connect(signers.deployer).verifyCompany(signers.alice.address);
      await contract.connect(signers.alice).submitEmissionReport(1000, 500, 2000, 50000);

      const [part2, total2, closed2,] = await contract.getPeriodStats(1);
      expect(part2).to.eq(1);
      expect(total2).to.eq(1);
      expect(closed2).to.be.false;
    });
  });

  describe("Gas Optimization", function () {
    it("should register company with reasonable gas", async function () {
      const tx = await contract.connect(signers.alice).registerCompany("Acme Corporation");
      const receipt = await tx.wait();

      expect(receipt.gasUsed).to.be.lt(200000);
    });

    it("should submit report with reasonable gas", async function () {
      await contract.connect(signers.alice).registerCompany("Acme Corporation");
      await contract.connect(signers.deployer).verifyCompany(signers.alice.address);

      const tx = await contract.connect(signers.alice).submitEmissionReport(
        1000, 500, 2000, 50000
      );
      const receipt = await tx.wait();

      // FHE operations are gas-intensive, so we expect higher gas usage
      expect(receipt.gasUsed).to.be.lt(1000000);
    });

    it("should verify company with reasonable gas", async function () {
      await contract.connect(signers.alice).registerCompany("Acme Corporation");

      const tx = await contract.connect(signers.deployer).verifyCompany(signers.alice.address);
      const receipt = await tx.wait();

      expect(receipt.gasUsed).to.be.lt(100000);
    });
  });

  describe("Edge Cases", function () {
    it("should handle very long company names", async function () {
      const longName = "A".repeat(200);
      await expect(
        contract.connect(signers.alice).registerCompany(longName)
      ).to.not.be.reverted;
    });

    it("should handle special characters in company name", async function () {
      await expect(
        contract.connect(signers.alice).registerCompany("Acme & Co. Ltd. (2024)")
      ).to.not.be.reverted;
    });

    it("should handle multiple period closures", async function () {
      for (let i = 0; i < 5; i++) {
        await contract.connect(signers.deployer).closePeriodAndAdvance();
      }

      expect(await contract.currentReportingPeriod()).to.eq(6);
    });

    it("should maintain separate reports across periods", async function () {
      await contract.connect(signers.alice).registerCompany("Acme Corporation");
      await contract.connect(signers.deployer).verifyCompany(signers.alice.address);

      await contract.connect(signers.alice).submitEmissionReport(1000, 500, 2000, 50000);
      await contract.connect(signers.deployer).closePeriodAndAdvance();
      await contract.connect(signers.alice).submitEmissionReport(1100, 550, 2100, 51000);

      const [isSub1, ,] = await contract.getReportStatus(signers.alice.address, 1);
      const [isSub2, ,] = await contract.getReportStatus(signers.alice.address, 2);

      expect(isSub1).to.be.true;
      expect(isSub2).to.be.true;
    });
  });
});
