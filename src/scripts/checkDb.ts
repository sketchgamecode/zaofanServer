import 'dotenv/config';
import { supabaseAdmin } from '../lib/supabase.js';

async function main() {
  console.log('Checking database table: world_state...');
  const { data, error } = await supabaseAdmin
    .from('world_state')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error querying world_state:', error);
  } else {
    console.log('Query succeeded! Data:', data);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
});
