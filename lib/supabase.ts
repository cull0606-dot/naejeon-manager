import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tghuvacfqseabypsbnsx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnaHV2YWNmcXNlYWJ5cHNibnN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTQyMDUsImV4cCI6MjA5NjY5MDIwNX0.CfywcVO1Htf4sSsBWqGMh0GYmulUfBSnrk7OPX3UHxA'

export const supabase = createClient(supabaseUrl, supabaseKey)
