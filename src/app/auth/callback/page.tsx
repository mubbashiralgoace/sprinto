'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

const Redirecting = () => (
  <div className="flex min-h-screen items-center justify-center text-sm text-neutral-600">Redirecting...</div>
);

const AuthCallbackClient = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const error = searchParams.get('error');
      const code = searchParams.get('code');

      if (error || !code) {
        console.error('[OAUTH_CALLBACK] Missing code or error:', { error, code });
        router.replace('/sign-in?error=oauth_failed');
        return;
      }

      router.replace(`/api/auth/callback?code=${encodeURIComponent(code)}`);
    };

    run().catch(() => {
      router.replace('/sign-in?error=oauth_failed');
    });
  }, [router, searchParams]);

  return <Redirecting />;
};

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Redirecting />}>
      <AuthCallbackClient />
    </Suspense>
  );
}
