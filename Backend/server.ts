// ⚠️  IMPORTANT: Load .env FIRST, before any other module is imported.
// nodemailer (emailService.ts) reads SMTP_USER/PASS at module init time,
// so dotenv must run before any import that transitively touches it.
import 'dotenv/config';

import app from "./src/app";
import './src/workers/feeBilling.worker';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});