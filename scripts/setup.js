import {writeFileSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
if(existsSync('.env')) {
 console.log('.env already exists; no secrets or settings changed.');
 process.exit(0);
}
const password=randomBytes(18).toString('hex');
const port=5433;
writeFileSync('.env',`POSTGRES_PASSWORD=${password}\nPOSTGRES_PORT=${port}\nDATABASE_URL=postgres://openiot:${password}@127.0.0.1:${port}/openiot_m1\nTOKEN_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}\nAPP_ORIGIN=http://localhost:5173\nPORT=3000\nHOST=127.0.0.1\nNODE_ENV=development\nMQTT_ENABLED=true\nMQTT_HOST=127.0.0.1\nMQTT_PORT=1883\n`,{mode:0o600,flag:'wx'});
console.log('Created .env with random credentials. Keep it private and back up the encryption key. PostgreSQL host port: 5433.');
