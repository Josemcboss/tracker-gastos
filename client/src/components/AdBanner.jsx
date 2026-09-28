import { useEffect, useRef } from 'react';
import './AdBanner.css';

const ADSENSE_CLIENT_ID = 'ca-pub-8572512148825737';

export default function AdBanner({
  slot = '',
  format = 'auto',
  responsive = 'true',
  className = '',
}) {
  const adRef = useRef(null);

  useEffect(() => {
    try {
      if (
        typeof window !== 'undefined' &&
        adRef.current &&
        !adRef.current.getAttribute('data-adsbygoogle-status')
      ) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (err) {
      // Silently handle adblock or double-push in dev
    }
  }, []);

  return (
    <div className={`ad-banner-container ${className}`}>
      <span className="ad-badge">PUBLICIDAD</span>
      <div className="ad-content-slot">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={ADSENSE_CLIENT_ID}
          data-ad-slot={slot || undefined}
          data-ad-format={format}
          data-full-width-responsive={responsive}
        />
      </div>
    </div>
  );
}
