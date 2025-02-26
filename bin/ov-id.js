#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";

// Try CommonJS require instead of ES import
let sdk;
try {
  sdk = import("@originvault/ov-id-sdk");
  console.log(chalk.gray("SDK loaded successfully")); // Debug log
} catch (error) {
  console.error(chalk.red("❌ Error loading SDK:"));
  console.error(chalk.gray("Error details:", error.message));
  process.exit(1);
}

const { createDID, getCurrentPrimaryDID, setPrimaryDID, signVC, verifyVC } = sdk;

program
  .version("1.0.0")
  .description("🚀 OriginVault ID CLI - Manage DIDs & Verifiable Credentials");

// Create a DID
program
  .command("create-did <method>")
  .description("Generate a new DID (methods: 'cheqd' or 'vda')")
  .action(async (method) => {
    if (!["cheqd", "vda"].includes(method)) {
      console.log(chalk.red("❌ Invalid method. Use 'cheqd' or 'vda'."));
      return;
    }
    try {
      const did = await createDID(method);
      console.log(chalk.green("✅ New DID Created:"), did);
    } catch (error) {
      console.log(chalk.red("❌ Error creating DID:"), error.message);
    }
  });

// Set Primary DID
program
  .command("set-primary <did>")
  .description("Set a specific DID as the primary signing DID")
  .action(async (did) => {
    try {
      await setPrimaryDID(did);
      console.log(chalk.green(`✅ Primary DID Set: ${did}`));
    } catch (error) {
      console.log(chalk.red("❌ Error setting primary DID:"), error.message);
    }
  });

// Show Primary DID
program
  .command("show-primary")
  .description("Display the primary DID used for signing")
  .action(async () => {
    try {
      const primaryDID = await getCurrentPrimaryDID();
      if (!primaryDID) {
        console.log(chalk.yellow("⚠️ No primary DID found. Use `ov-id set-primary <did>`."));
      } else {
        console.log(chalk.green(`✅ Primary DID: ${primaryDID}`));
      }
    } catch (error) {
      console.log(chalk.red("❌ Error retrieving primary DID:"), error.message);
    }
  });

// Sign a Verifiable Credential
program
  .command("sign-vc <subject>")
  .description("Sign a Verifiable Credential for a given subject")
  .action(async (subject) => {
    try {
      const signedVC = await signVC(undefined, { id: subject });
      console.log(chalk.green("✅ Signed Verifiable Credential:\n"), signedVC);
    } catch (error) {
      console.log(chalk.red("❌ Error signing VC:"), error.message);
    }
  });

// Verify a Verifiable Credential
program
  .command("verify-vc <vc>")
  .description("Verify a given Verifiable Credential")
  .action(async (vc) => {
    try {
      const isValid = await verifyVC(vc);
      console.log(chalk.green(`✅ VC Verification Result: ${isValid ? "Valid" : "Invalid"}`));
    } catch (error) {
      console.log(chalk.red("❌ Error verifying VC:"), error.message);
    }
  });

program.parse(process.argv); 