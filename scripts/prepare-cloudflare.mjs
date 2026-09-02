import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const configPath = join(process.cwd(), 'dist', 'server', 'wrangler.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));

if (!config.main || !config.assets?.directory) {
  throw new Error('Vinext did not produce the expected Cloudflare Worker build.');
}

config.name = 'pmts-training-erp';
config.d1_databases = [
  {
    binding: 'DB',
    database_name: 'pmts-training-erp-db',
    database_id: '155cd17a-6983-4325-8904-5b6259c5dc21',
    migrations_dir: '../../drizzle',
  },
];

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
