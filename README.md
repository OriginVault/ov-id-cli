# 🚀 `ov-id-cli` - OriginVault Identity CLI
A command-line interface (CLI) for managing **decentralized identities (DIDs)** and **verifiable credentials (VCs)** using `@originvault/ov-id-sdk`.

## 📦 Installation
```bash
npm install -g @originvault/ov-id-cli
```

## 🚀 Usage
```bash
ov-id --help
```

### ✅ Create a DID
```bash
ov-id create-did cheqd
```
### ✅ Set a Primary DID
```bash
ov-id set-primary did:cheqd:mainnet:1234
```
### ✅ Show Primary DID
```bash
ov-id show-primary
```
### ✅ Sign a Verifiable Credential
```bash
ov-id sign-vc did:example:5678
```
### ✅ Verify a Verifiable Credential
```bash
ov-id verify-vc <signed-vc>
```

## 🛠 Dependencies
- [@originvault/ov-id-sdk](https://github.com/originvault/ov-id-sdk) - Decentralized Identity SDK
- [Commander.js](https://www.npmjs.com/package/commander) - CLI framework
- [Chalk](https://www.npmjs.com/package/chalk) - Terminal string styling

📜 Licensed under **MIT**.
