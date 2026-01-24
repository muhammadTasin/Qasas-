'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AuthForm } from '@/components/AuthForm';

export default function SignInPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  if (status === 'authenticated') {
    return <div>Redirecting...</div>;
  }

  if (status === 'loading') {
    return null;
  }

  return <AuthForm mode="signin" />;
}
