import React, { useState } from 'react';
import { loginOrRegister } from '../api/supabase';
import styles from '../styles/AuthPage.module.css';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // clear previous
    setEmailError(null);
    setPasswordError(null);
    setFormError(null);

    const result = await loginOrRegister({ email, password });
    setLoading(false);

    if (result.error) {
      const msg = result.error.message;
      if (msg.toLowerCase().includes('email')) {
        setEmailError(msg);
      } else if (msg.toLowerCase().includes('password')) {
        setPasswordError(msg);
      } else {
        setFormError(msg);
      }
      return;
    }

    if (result.created && !result.confirmed) {
      setFormError('Account created! Check your email for a confirmation link.');
    } else {
      window.location.href = '/';
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.navbar}>
        <img
          src="/logo-aliya.png"
          alt="Brand logo"
          className={styles['navbar-logo']}
        />
      </header>

      <main className={styles['form-wrapper']}>
        <form onSubmit={handleSubmit} className={styles['email-form-card']}>
          <div className={styles['email-form-header']}>
            <h1>Sign In to Continue</h1>
          </div>

          <div className={styles['email-form-grid']}>
            <div className={styles['email-form-group']}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className={styles['email-form-input']}
                required
              />
              {emailError && (
                <p className={styles['email-form-field-error']}>
                  {emailError}
                </p>
              )}
            </div>

            <div className={styles['email-form-group']}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={styles['email-form-input']}
                required
              />
              {passwordError && (
                <p className={styles['email-form-field-error']}>
                  {passwordError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={styles['email-form-button']}
            >
              {loading ? 'Please wait…' : 'Sign In'}
            </button>
          </div>

          {formError && (
            <div className={styles['email-form-result']}>
              <p className={styles['email-form-result-label']}>
                {formError}
              </p>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
