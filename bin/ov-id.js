#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2';

ed25519.etc.sha512Sync = sha512;

// Import functions from the SDK
import { 
  createDID,
  verifyPrimaryDID,
  getPrimaryDID, 
  setPrimaryDID, 
  getPrivateKeyForPrimaryDID,
  convertRecoveryToPrivateKey,
  convertPrivateKeyToRecovery,
  encryptDataForDID,
  signVC, 
  verifyVC,
  getDevelopmentEnvironmentMetadata,
  getCosmosPayerSeed,
  setCosmosPayerSeed,
  listAllKeys,
  initializeAgent,
  packageStore,
  userStore,
  userAgent,
  parentStore,
  createResource,
} from '@originvault/ov-id-sdk';

program
  .version("1.0.1")
  .description("🚀 OriginVault ID CLI - Manage DIDs & Verifiable Credentials");

// Add password management
let storedPassword = null;
let storedPrimaryDID = null;  // Add this to store the DID in memory
let payerSeed = null;
async function ensurePassword() {
  if (!storedPassword) {
    const { password } = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message: ' Enter your password:',
        mask: '*',
        validate: (input) => {
          if (!input || input.length < 1) {
            return 'Password cannot be empty';
          }
          return true;
        }
      }
    ]);
    storedPassword = password;
  }
  return storedPassword;
}

async function promptForSeed() {
//       // First prompt for the type of input
//       const { inputType } = await inquirer.prompt([
//         {
//           type: 'list',
//           name: 'inputType',
//           message: 'What type of authentication are you using?',
//           choices: [
//             { name: 'Recovery Phrase (12 or 24 words)', value: 'recovery' },
//             { name: 'Private Key (base64 format)', value: 'private' }
//           ]
//         }
//       ]);

      const { secret } = await inquirer.prompt([
        {
          type: 'password',
          name: 'secret',
          message: 'Enter your recovery phrase (space-separated words):',
          mask: '*',
          validate: (input) => {
            // if (inputType === 'recovery') {
              const wordCount = input.trim().split(/\s+/).length;
              if (wordCount !== 12 && wordCount !== 24) {
                return 'Recovery phrase must be 12 or 24 words';
              }
            // } else {
            //   // Check if it's base64 format
            //   const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(input);
              
            //   if (!isBase64) {
            //     return 'Private key must be in base64 format';
            //   }
            // }
            return true;
          }
        }
      ]);

      let recoveryPhrase = secret;

      // if (inputType === 'private') {
      //   // Convert recovery phrase to private key
      //   recoveryPhrase = await convertPrivateKeyToRecovery(secret);
      // }
      
      return recoveryPhrase;
}

async function ensurePayerSeed() {
  // Prompt the user to choose between using the primary payer seed or inputting a new seed
  const { seedChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'seedChoice',
      message: 'Do you want to use the primary payer seed or input a new seed?',
      choices: [
        { name: 'Use primary payer seed', value: 'primary' },
        { name: 'Input new seed', value: 'input' }
      ]
    }
  ]);

  if (seedChoice === 'primary') {
    payerSeed = await getCosmosPayerSeed();
  }

  if (!payerSeed || seedChoice === 'input') {
    payerSeed = await promptForSeed();
  }

  await initializeAgent({ payerSeed: payerSeed });
  return payerSeed;
}

// Update the password check middleware to include 2FA
program.hook('preAction', async (action) => {
  // Skip checks for these commands
  const commandName = action.args[0]
  const skipAuthCommands = ['help','set-primary', 'show-primary'];

  if (skipAuthCommands.includes(commandName)) return;
  
  try {
    // Check password
    await ensurePassword();
    
    // Load primary DID if we haven't already
    if (!storedPrimaryDID) {
      storedPrimaryDID = await verifyPrimaryDID(storedPassword);
      if(!storedPrimaryDID){
        console.log(chalk.red("Primary DID not found. A primary DID is needed to use this command."));
        process.exit(1);
      }
    }

  } catch (error) {
    console.log(chalk.red("❌ Authentication Error:"), error.message);
    process.exit(1);
  }
});

program.command("get-store-info [store]")
  .description("Get the store info")
  .action(async (store) => {
    if(store === "package"){
      const packageStoreInfo = await packageStore.initialize();
      console.log(chalk.green("✅ Package Store Info:"), packageStoreInfo);
    } else if(store === "user"){
      console.log(chalk.green("✅ User Store Info:"), userStore );
    } else if(store === "parent"){
      const parentStoreInfo = await parentStore.initialize();
      console.log(chalk.green("✅ Parent Store Info:"), parentStoreInfo);
    } else {
      console.log(chalk.red("❌ Invalid store. Use 'package', 'user' or 'parent'."));
    }
  });

// Create a DID
program
    .command("create-did [method]")
  .description("Generate a new DID (methods: 'cheqd:mainnet', 'cheqd:testnet' or 'key')")
  .action(async (method) => {
    if (!["cheqd:mainnet", "cheqd:testnet", "key", ""].includes(method)) {
      console.log(chalk.red("❌ Invalid method. Use 'cheqd:mainnet', 'cheqd:testnet' or 'key'."));
      return;
    }
    if(method === "cheqd:mainnet"){
      
      await ensurePayerSeed();
    }
    try {
      const { did, mnemonic } = await createDID({ method, agent: userAgent });
      console.log(chalk.green("✅ New DID Created:"), did);
      console.log(chalk.blue("🔑 Mnemonic (keep this safe!):"), mnemonic);
    } catch (error) {
      console.log(chalk.red("❌ Error creating DID:"), error.message);
    }
  });

program
  .command("set-cosmos-payer-seed [seed]")
  .description("✨Set the Cosmos payer seed")
  .action(async (seed) => {
    if(!seed){
      seed = await ensurePayerSeed();
      await setCosmosPayerSeed(seed);
    }
  });
  
// Import a DID
program
  .command("import-did <did>")
  .description("Import an existing DID")
  .action(async (did) => {
    try {
      const method = did.split(':')[1];
      const storeMap = [
        { name: 'packageStore', value: 'packageStore' },
        { name: 'userStore', value: 'userStore' },
      ];

      const { selectedStore } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedStore',
          message: 'Select a store to import the DID:',
          choices: storeMap,
        }
      ]);
      // First prompt for the type of input
      const { inputType } = await inquirer.prompt([
        {
          type: 'list',
          name: 'inputType',
          message: 'What type of authentication are you using?',
          choices: [
            { name: 'Recovery Phrase (12 or 24 words)', value: 'recovery' },
            { name: 'Private Key (base64 format)', value: 'private' }
          ]
        }
      ]);

      // Then prompt for the actual value
      const { secret } = await inquirer.prompt([
        {
          type: 'password',
          name: 'secret',
          message: inputType === 'recovery' 
            ? 'Enter your recovery phrase (space-separated words):' 
            : 'Enter your private key (base64 format):',
          mask: '*',
          validate: (input) => {
            if (inputType === 'recovery') {
              const wordCount = input.trim().split(/\s+/).length;
              if (wordCount !== 12 && wordCount !== 24) {
                return 'Recovery phrase must be 12 or 24 words';
              }
            } else {
              // Check if it's base64 format
              const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(input);
              
              if (!isBase64) {
                return 'Private key must be in base64 format';
              }
            }
            return true;
          }
        }
      ]);

      let privateKey = secret;

      if (inputType === 'recovery') {
        // Convert recovery phrase to private key
        privateKey = await convertRecoveryToPrivateKey(secret);
      }

      await ensurePassword(); // Ensure the user has entered their password
      const store = selectedStore === 'packageStore' ? packageStore : userStore;
      const confirmed = await store.importDID(did, privateKey, method);
      if (confirmed) {
        storedPrimaryDID = did;  // Update the stored DID
        console.log(chalk.green(`✅ DID Imported: ${did}`));
      } else {
        console.log(chalk.red("❌ Failed to import DID"));
      }
    } catch (error) {
      console.log(chalk.red("❌ Error importing DID:"), error.message);
    }
  });

// Set Primary DID
program
  .command("set-primary <did>")
  .description("Set a specific DID as the primary signing DID")
  .action(async (did) => {
    try {
      // First prompt for the type of input
      const { inputType } = await inquirer.prompt([
        {
          type: 'list',
          name: 'inputType',
          message: 'What type of authentication are you using?',
          choices: [
            { name: 'Recovery Phrase (12 or 24 words)', value: 'recovery' },
            { name: 'Private Key (base64 format)', value: 'private' }
          ]
        }
      ]);

      // Then prompt for the actual value
      const { secret } = await inquirer.prompt([
        {
          type: 'password',
          name: 'secret',
          message: inputType === 'recovery' 
            ? 'Enter your recovery phrase (space-separated words):' 
            : 'Enter your private key (base64 format):',
          mask: '*',
          validate: (input) => {
            if (inputType === 'recovery') {
              const wordCount = input.trim().split(/\s+/).length;
              if (wordCount !== 12 && wordCount !== 24) {
                return 'Recovery phrase must be 12 or 24 words';
              }
            } else {
              // Check if it's base64 format
              const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(input);
              
              if (!isBase64) {
                return 'Private key must be in base64 format';
              }
            }
            return true;
          }
        }
      ]);

      let privateKey = secret;

      if (inputType === 'recovery') {
        // Convert recovery phrase to private key
        privateKey = await convertRecoveryToPrivateKey(secret);
      }

      await ensurePassword();

      const confirmed = await setPrimaryDID(did, privateKey, storedPassword);
      if (confirmed) {
        storedPrimaryDID = did;  // Update the stored DID
        console.log(chalk.green(`✅ Primary DID Set: ${did}`));
      } else {
        console.log(chalk.red("❌ Failed to set primary DID"));
      }
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
      storedPrimaryDID = await getPrimaryDID(storedPassword);
      if (!storedPrimaryDID) {
        console.log(chalk.yellow("⚠️ No primary DID found. Use `ov-id set-primary <did>`."));
      } else {
        console.log(chalk.green(`✅ Primary DID: ${storedPrimaryDID}`));
      }
    } catch (error) {
      console.log(chalk.red("❌ Error retrieving primary DID:"), error.message);
    }
  });

// Get DID
program
  .command("get-did <didString>")
  .description("Get the DID for the primary signing DID")
  .action(async (didString) => {
    const did = await userStore.getDID(didString);
    if (!did) {
      did = await packageStore.getDID(didString);
      if (!did) {
        console.log(chalk.red("❌ No DID found"));
      } else {
        console.log(chalk.green("✅ DID:"), did);
      }
    } else {
      console.log(chalk.green("✅ DID:"), did);
    }
  });

// List all DIDs
program
  .command("list-dids [provider]")
  .description("List all DIDs")
  .action(async (provider) => {
    let dids;
    const storeMap = [
        { name: 'packageStore', value: 'packageStore' },
        { name: 'userStore', value: 'userStore' },
      ];

      const { selectedStore } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedStore',
          message: 'Select a store to view more information:',
          choices: storeMap,
        }
      ]);

      if (selectedStore === 'packageStore') {
        dids = await packageStore.listDIDs();
      } else {
        dids = await userStore.listDIDs();
      }

      if (dids.length === 0) {
      console.log(chalk.yellow("⚠️ No DIDs found"));
    } else {
      const didsMap = dids.map(didObj => didObj.did);

      const { selectedDid } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedDid',
          message: 'Select a DID to view more information:',
          choices: didsMap,
        }
      ]);

      // Find the selected DID object to display more information
      const selectedDidObj = dids.find(didObj => didObj.did === selectedDid);

      // Show more information about the selected DID
      console.log(chalk.green("✅ Selected DID:"), selectedDid);
      console.log(chalk.blue("Provider:"), selectedDidObj.provider);
      console.log(chalk.blue("Controller Key ID:"), selectedDidObj.controllerKeyId);
      console.log(chalk.blue("Keys:"), JSON.stringify(selectedDidObj.keys, null, 2)); // Stringify keys
      console.log(chalk.blue("Services:"), JSON.stringify(selectedDidObj.services, null, 2)); // Stringify services
    }
  }); 

// List all Keys
program
  .command("list-all-keys")
  .description("List all keys on the keyring")
  .action(async () => {
    const keys = await listAllKeys();
    console.log(chalk.green("✅ Keys:"), keys);
  });

// Sign a Verifiable Credential
program
  .command("sign-vc <subject>")
  .description("Sign a Verifiable Credential for a given subject")
  .action(async (subject) => {
    try {
      const signedVC = await signVC(subject, storedPassword);
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

// New command to show recovery phrase
program
  .command("show-recovery [did]")
  .description("Display the recovery phrase for the primary DID")
  .action(async (did) => {
    try {
      await ensurePassword(); // Ensure the user has entered their password
      if(!did){
        // Retrieve the primary DID's private key (this assumes you have a way to get it)
        const privateKey = await getPrivateKeyForPrimaryDID(storedPassword); // Placeholder function

        // Convert the private key to a recovery phrase
        const recoveryPhrase = await convertPrivateKeyToRecovery(privateKey);
        console.log(chalk.green("✅ Recovery Phrase:"), recoveryPhrase);
      } else {
        const didObj = await userStore.getDID(did);
        if(!didObj){
          didObj = await packageStore.getDID(did);
        }
        const recoveryPhrase = await convertPrivateKeyToRecovery(didObj.privateKey);
        console.log(chalk.green("✅ Recovery Phrase:"), recoveryPhrase);
      }
    } catch (error) {
      console.log(chalk.red("❌ Error retrieving recovery phrase:"), error.message);
    }
});

// Encrypt data for a specific DID
program
  .command("encrypt-data <did> <message>")
  .description("Encrypt a message for the specified DID")
  .action(async (did, message) => {
    try {
      const encryptedData = await encryptDataForDID(did, message);
      if (encryptedData) {
        console.log(chalk.green("✅ Encrypted Data:"), encryptedData);
      } else {
        console.log(chalk.red("❌ Failed to encrypt data. Public key not found."));
      }
    } catch (error) {
      console.log(chalk.red("❌ Error encrypting data:"), error.message);
    }
  });

// Show Dev Environment Metdata
program
  .command("show-dev-metadata")
  .description("Display the development environment metadata")
  .action(async () => {
    const metadata = await getDevelopmentEnvironmentMetadata();
    console.log(chalk.green("✅ Dev Environment Metadata:"), metadata);
  });

// program.command("create-resource")
//   .description("Create a new resource")
//   .action(async () => {
//     const resource = await createResource({ didObject: packageDID, name: '', directory: '../ov-dev-certs', provider: packageStore.cheqdMainnetProvider, agent: packageStore.agent, keyStore: packageStore.privateKeyStore });
    
//     console.log(chalk.green("✅ Resource Created:"), resource);
//   });

program.parse(process.argv); 