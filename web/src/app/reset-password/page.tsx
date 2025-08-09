// src/app/reset-password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebaseClient';
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';
import Link from 'next/link';
import styles from './page.module.css'; // We'll create this CSS module

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');
  const actionCode = searchParams.get('oobCode');
  const apiKey = searchParams.get('apiKey');
  const continueUrl = searchParams.get('continueUrl');

  const [state, setState] = useState<{
    status: 'verifying' | 'ready' | 'success' | 'error';
    message: string;
    newPassword: string;
    confirmPassword: string;
    email: string | null;
  }>({
    status: 'verifying',
    message: 'Verifying reset link...',
    newPassword: '',
    confirmPassword: '',
    email: null,
  });

  // On mount, verify the action code
  useEffect(() => {
    if (!mode || !actionCode || !apiKey) {
      setState({
        status: 'error',
        message: 'Invalid or missing reset link. Please try again.',
        newPassword: '',
        confirmPassword: '',
        email: null,
      });
      return;
    }

    if (mode !== 'resetPassword') {
      setState({
        status: 'error',
        message: 'This link is not for resetting a password.',
        newPassword: '',
        confirmPassword: '',
        email: null,
      });
      return;
    }

    // Verify the password reset code (this also fetches the email)
    verifyPasswordResetCode(auth, actionCode)
      .then((email) => {
        setState((prev) => ({ ...prev, status: 'ready', email }));
      })
      .catch((err) => {
        console.error('Invalid reset code:', err);
        setState({
          status: 'error',
          message: 'Invalid or expired link. Request a new password reset.',
          newPassword: '',
          confirmPassword: '',
          email: null,
        });
      });
  }, [mode, actionCode, apiKey]);

  // Handle password reset submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.newPassword !== state.confirmPassword) {
      setState((prev) => ({ ...prev, message: 'Passwords do not match.' }));
      return;
    }

    if (state.newPassword.length < 6) {
      setState((prev) => ({ ...prev, message: 'Password must be at least 6 characters.' }));
      return;
    }

    try {
      await confirmPasswordReset(auth, actionCode!, state.newPassword);
      // Clear the reset code from URL
      router.replace('/reset-password?status=success');
      setState((prev) => ({
        ...prev,
        status: 'success',
        message: 'Your password has been reset successfully.',
      }));
    } catch (err: unknown) {
      console.error('Password reset failed:', err);
      let message = 'Failed to reset password. Try again.';
      if (err instanceof Error) message = err.message;
      setState((prev) => ({ ...prev, message }));
    }
  };

  // If already successful, show success message
  useEffect(() => {
    if (searchParams.get('status') === 'success') {
      setState({
        status: 'success',
        message: 'Your password has been reset successfully.',
        newPassword: '',
        confirmPassword: '',
        email: null,
      });
    }
  }, [searchParams]);

  if (state.status === 'verifying') {
    return (
      <main className={styles.resetContainer}>
        <div className={styles.card}>
          <h2>Verifying Link...</h2>
          <p>Please wait while we validate your reset request.</p>
        </div>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className={styles.resetContainer}>
        <div className={styles.card}>
          <h2>Password Reset Failed</h2>
          <p className={styles.error}>{state.message}</p>
          <Link href="/login" className={styles.linkButton}>
            Back to Login
          </Link>
        </div>
      </main>
    );
  }

  if (state.status === 'success') {
    return (
      <main className={styles.resetContainer}>
        <div className={styles.card}>
          <h2>Password Reset Successful</h2>
          <p className={styles.success}>{state.message}</p>
          <Link href="/login" className={styles.primaryButton}>
            Log In Now
          </Link>
        </div>
      </main>
    );
  }

  // Main reset form (status === 'ready')
  return (
    <main className={styles.resetContainer}>
      <div className={styles.card}>
        <h1>Reset Your Password</h1>
        <p>Enter a new password for <strong>{state.email}</strong></p>

        {state.message && <p className={styles.error}>{state.message}</p>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={state.newPassword}
              onChange={(e) =>
                setState((prev) => ({ ...prev, newPassword: e.target.value }))
              }
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={state.confirmPassword}
              onChange={(e) =>
                setState((prev) => ({ ...prev, confirmPassword: e.target.value }))
              }
              required
            />
          </div>

          <button type="submit" className={styles.primaryButton}>
            Reset Password
          </button>
        </form>

        <Link href="/login" className={styles.linkButton}>
          Back to Login
        </Link>
      </div>
    </main>
  );
}