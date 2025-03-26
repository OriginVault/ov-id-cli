import dotenv from 'dotenv';
import { signRelease } from '@originvault/ov-id-sdk';

dotenv.config();

(async () => {
    try {
        await signRelease();
    } catch (error) {
        console.error("❌ Error signing release metadata:", error);
        process.exit(1);
    }
})(); 