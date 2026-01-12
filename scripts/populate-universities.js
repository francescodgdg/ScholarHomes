const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateUniversities() {
  console.log('Fetching US universities from GitHub...');

  const response = await fetch('https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json');
  const allUniversities = await response.json();

  // Filter for US universities only
  const usUniversities = allUniversities.filter(u => u.country === 'United States');
  console.log(`Found ${usUniversities.length} US universities`);

  // Get existing universities to avoid duplicates
  console.log('Fetching existing universities from database...');
  const { data: existing, error: fetchError } = await supabase
    .from('universities')
    .select('name');

  if (fetchError) {
    console.error('Error fetching existing universities:', fetchError);
    process.exit(1);
  }

  const existingNames = new Set(existing.map(u => u.name.toLowerCase()));
  console.log(`Found ${existingNames.size} existing universities in database`);

  // Filter out duplicates
  const newUniversities = usUniversities.filter(u =>
    !existingNames.has(u.name.toLowerCase())
  );

  console.log(`${newUniversities.length} new universities to insert`);

  if (newUniversities.length === 0) {
    console.log('No new universities to insert!');
    return;
  }

  // Prepare data for insertion
  const toInsert = newUniversities.map(u => ({
    name: u.name,
    domain: u.domains?.[0] || '',
  }));

  // Insert in batches of 100
  const batchSize = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('universities')
      .insert(batch)
      .select();

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error.message);
      errors += batch.length;
    } else {
      inserted += data.length;
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toInsert.length / batchSize)} (${inserted} total)`);
    }
  }

  console.log(`\nDone! Inserted ${inserted} universities (${errors} errors)`);

  // Verify final count
  const { count } = await supabase
    .from('universities')
    .select('*', { count: 'exact', head: true });

  console.log(`Total universities in database: ${count}`);
}

populateUniversities().catch(console.error);
