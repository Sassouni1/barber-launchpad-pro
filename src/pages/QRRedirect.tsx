import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function QRRedirect() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!shortCode) { setError(true); return; }
    // Fire and forget — replace location so the redirect page never enters history.
    supabase.rpc('resolve_qr_link', { code: shortCode }).then(({ data, error: err }) => {
      if (err || !data || data.length === 0) {
        setError(true);
        return;
      }
      window.location.replace(data[0].destination_url);
    });
  }, [shortCode]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Link Not Found</h1>
        <p style={{ color: '#666' }}>This QR code is no longer active or the link is invalid.</p>
      </div>
    );
  }

  // Render nothing during the redirect — avoids the visible "Membership" flash.
  return null;
}
