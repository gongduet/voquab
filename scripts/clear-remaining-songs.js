import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Clearing active_song_id from user_settings (using service role)...');

  // Clear any active_song_id references in user_settings
  const { data: updated, error: settingsError } = await supabase
    .from('user_settings')
    .update({ active_song_id: null })
    .not('active_song_id', 'is', null)
    .select();

  if (settingsError) {
    console.error('Error clearing user_settings:', settingsError.message);
  } else {
    console.log(`✓ Cleared active_song_id from ${updated?.length || 0} user_settings rows`);
  }

  // Now delete remaining songs
  console.log('Deleting remaining songs...');

  const { data: songs, error: selectError } = await supabase
    .from('songs')
    .select('song_id, title');

  if (selectError) {
    console.error('Error selecting songs:', selectError.message);
    return;
  }

  console.log(`Found ${songs.length} song(s) to delete`);

  for (const song of songs) {
    const { error: deleteError } = await supabase
      .from('songs')
      .delete()
      .eq('song_id', song.song_id);

    if (deleteError) {
      console.error(`Error deleting ${song.title}:`, deleteError.message);
    } else {
      console.log(`✓ Deleted: ${song.title}`);
    }
  }

  // Verify
  const { count } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true });

  console.log(`\nFinal songs count: ${count}`);
}

main().catch(console.error);
