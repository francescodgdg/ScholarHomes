import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create a Supabase client with the user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client with user's auth to get their ID
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    // Admin client to delete user
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Get the current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      throw new Error('Unable to get user')
    }

    const userId = user.id

    // Get user's profile for avatar URL
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single()

    // Get user's listings for images
    const { data: listings } = await supabaseAdmin
      .from('listings')
      .select('images')
      .eq('user_id', userId)

    // Delete avatar from storage if exists
    if (profile?.avatar_url) {
      const avatarPath = extractStoragePath(profile.avatar_url, 'avatars')
      if (avatarPath) {
        await supabaseAdmin.storage.from('avatars').remove([avatarPath])
      }
    }

    // Delete listing images from storage
    if (listings && listings.length > 0) {
      const imagePaths: string[] = []
      for (const listing of listings) {
        if (listing.images && Array.isArray(listing.images)) {
          for (const imageUrl of listing.images) {
            const path = extractStoragePath(imageUrl, 'listings')
            if (path) {
              imagePaths.push(path)
            }
          }
        }
      }
      if (imagePaths.length > 0) {
        await supabaseAdmin.storage.from('listings').remove(imagePaths)
      }
    }

    // Delete the auth user (this will cascade delete profile, listings, etc.)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      throw new Error(`Failed to delete user: ${deleteError.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})

// Helper function to extract storage path from public URL
function extractStoragePath(url: string, bucket: string): string | null {
  try {
    // URL format: https://xxx.supabase.co/storage/v1/object/public/bucket/path
    const regex = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`)
    const match = url.match(regex)
    return match ? match[1] : null
  } catch {
    return null
  }
}
