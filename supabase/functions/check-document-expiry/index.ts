
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Types based on the app
type UserRole = 'operator' | 'guide' | 'driver' | 'vehicle_owner';

interface Document {
  id: string;
  user_id: string;
  document_type: string;
  expiry_date: string;
  status: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 0. Security Hardening: Internal Secret Check
    const internalSecret = Deno.env.get('CHECK_DOCUMENT_EXPIRY_SECRET');
    const requestSecret = req.headers.get('x-expiry-secret');

    if (!internalSecret) {
      console.error('[check-document-expiry] Configuration error: CHECK_DOCUMENT_EXPIRY_SECRET not set');
      return new Response(
        JSON.stringify({ error: 'Internal server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (requestSecret !== internalSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch valid documents with expiry dates
    // Joining with profiles to get roles for future logic if needed
    const { data: documents, error: docError } = await supabaseAdmin
      .from('documents')
      .select('id, user_id, document_type, expiry_date, status, profiles(role)')
      .eq('status', 'valid')
      .not('expiry_date', 'is', null);

    if (docError) throw docError;

    const summary = {
      processed: 0,
      remindersSent: 0,
      errors: [] as string[]
    };

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const doc of documents) {
      summary.processed++;
      const expiry = new Date(doc.expiry_date);
      expiry.setHours(0, 0, 0, 0);

      const diffTime = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // We send reminders at specific intervals or if expired
      let reminderType: 'soon' | 'expiring' | 'urgent' | 'expired' | null = null;
      let daysLabel = '';

      if (diffDays === 0) {
        reminderType = 'expired';
        daysLabel = 'today';
      } else if (diffDays < 0) {
        reminderType = 'expired';
        daysLabel = 'already';
      } else if (diffDays === 1) {
        reminderType = 'urgent';
        daysLabel = 'tomorrow';
      } else if (diffDays === 3 || diffDays === 7) {
        reminderType = 'urgent';
        daysLabel = `in ${diffDays} days`;
      } else if (diffDays === 14 || diffDays === 30) {
        reminderType = 'expiring';
        daysLabel = `in ${diffDays} days`;
      }

      if (reminderType) {
        const metadataKey = `expiry_${doc.id}_${diffDays}`;
        
        // 2. Check for duplicate notification for this specific day
        const { data: existing } = await supabaseAdmin
          .from('notifications')
          .select('id')
          .eq('user_id', doc.user_id)
          .contains('metadata', { expiry_token: metadataKey })
          .limit(1);

        if (existing && existing.length > 0) {
          continue; // Already notified for this interval
        }

        // 3. Create Notification
        const docLabel = doc.document_type.replace(/_/g, ' ').toUpperCase();
        let title = '';
        let message = '';
        let type = 'DOCUMENT_EXPIRY_REMINDER';

        if (reminderType === 'expired') {
          title = 'Document Expired';
          message = `Your ${docLabel} has expired ${daysLabel === 'today' ? 'today' : 'already'}. Please upload a new version immediately to remain compliant.`;
          type = 'DOCUMENT_EXPIRED';
        } else {
          title = 'Document Expiring Soon';
          message = `Your ${docLabel} is expiring ${daysLabel}. Please prepare a renewal.`;
        }

        const { error: notifError } = await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: doc.user_id,
            type,
            title,
            message,
            link: '/profile', // Profile page usually has document manager
            metadata: { 
              expiry_token: metadataKey,
              document_id: doc.id,
              days_remaining: diffDays
            },
            is_read: false,
            created_at: new Date().toISOString()
          });

        if (notifError) {
          summary.errors.push(`Failed to notify user ${doc.user_id} for doc ${doc.id}: ${notifError.message}`);
        } else {
          summary.remindersSent++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
