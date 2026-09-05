/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' }
    ]
  },
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://images.unsplash.com https://*.stripe.com",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://*.stripe.com https://*.supabase.co https://challenges.cloudflare.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://challenges.cloudflare.com",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join('; ')
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      ],
    }]
  },
};
export default nextConfig;
