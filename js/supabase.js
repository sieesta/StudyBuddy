// js/supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// IMPORTANT: Replace with your actual Supabase URL and Anon Key
export const supabaseUrl = 'https://lgjnltfccgutbjiafecf.supabase.co';
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnam5sdGZjY2d1dGJqaWFmZWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTQ4ODgsImV4cCI6MjA5NDM5MDg4OH0.RTreRTkMjahqer1H9hHUU3nJDLSw8zp2YZ3Y9h1jzEE';

if (supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseKey === 'YOUR_SUPABASE_ANON_KEY') {
    alert('Please replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY in js/supabase.js');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
