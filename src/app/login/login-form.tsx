'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import styles from './login-form.module.css';

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirect: false,
        redirectTo: callbackUrl,
      });

      if (result?.error) {
        setError('Email o contraseña incorrectos.');
        setPending(false);
        return;
      }

      // El refresh permite que el proxy vea la cookie nueva antes de navegar.
      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError('No se pudo iniciar sesión. Inténtalo de nuevo.');
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.field}>
        <span>Email</span>
        <input
          className={styles.input}
          type="email"
          name="email"
          autoComplete="username"
          placeholder="admin@wedding.com"
          required
        />
      </label>

      <label className={styles.field}>
        <span>Contraseña</span>
        <input
          className={styles.input}
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          minLength={6}
          required
        />
      </label>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? 'Comprobando…' : 'Entrar'}
      </button>
    </form>
  );
}
