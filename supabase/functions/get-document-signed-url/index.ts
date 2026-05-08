
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Declare Deno to avoid TypeScript errors in environments where Deno types are not automatically included
declare const Deno: any;

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  // 2. Handle Preflight OPTIONS request immediately
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 3. Parse and Validate Body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { bucket, path: rawPath, expiresIn } = body;
    if (!rawPath) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sanitize path
    const path = rawPath.replace(/^\/+/, '').replace(/\/+/g, '/');

    // 4. Initialize Supabase Clients
    // Client for Auth Context (uses the Authorization header from the request)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Admin Client for Database/Storage Access (Bypasses RLS)
    // Only used AFTER we verify the user's identity and role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 5. Verify User Identity
    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Verify Admin Role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Determine Bucket and Generate Signed URL
    let targetBucket = bucket || 'provider-documents'; // Default bucket
    
    // Heuristic: Check if path belongs to the legacy/compliance bucket
    // If it doesn't start with a standard role folder, check compliance-docs
    if (!path.startsWith('operator/') && !path.startsWith('guide/') && !path.startsWith('driver/') && !path.startsWith('vehicle_owner/')) {
       // Also check if the path looks like 'userid/docname' which is typical for compliance-docs
       if (path.includes('/') && path.split('/')[0].length > 20) { // simple uuid check length
          targetBucket = 'compliance-docs'; 
       }
    }

    // Attempt generation
    let result = await supabaseAdmin
      .storage
      .from(targetBucket)
      .createSignedUrl(path, expiresIn || 300) // Default 5 minutes expiry

    // Fallback: If failed (likely file not found in that bucket), try the other bucket
    if (result.error) {
       const altBucket = targetBucket === 'provider-documents' ? 'compliance-docs' : 'provider-documents';
       const altResult = await supabaseAdmin
        .storage
        .from(altBucket)
        .createSignedUrl(path, expiresIn || 300)
       
       // If the fallback succeeded, use it
       if (!altResult.error) {
         result = altResult;
       }
    }

    if (result.error) {
      console.error('Storage Error:', result.error);
      return new Response(
        JSON.stringify({ error: `Storage Error: ${result.error.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 9. Return Success
    return new Response(
      JSON.stringify({ signedUrl: result.data.signedUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    // 10. Global Error Handler
    console.error('Edge Function Unexpected Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
