'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import styles from './login-form.module.css';

export default function LoginForm({
  callbackUrl,
  error,
}: {
  callbackUrl: string;
  error?: string;
}) {
  const [pending, setPending] = useState(false);

  function onClick() {
    if (pending) return;
    setPending(true);
    // Redirección completa a Google: el botón se queda pulsado por si el
    // usuario vuelve atrás con el navegador.
    void signIn('google', { redirectTo: callbackUrl });
  }

  return (
    <div className={styles.form}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button
        className="btn btn-primary"
        type="button"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? 'Redirigiendo a Google…' : 'Continuar con Google'}
      </button>

      <p className={styles.hint}>
        Entra con tu cuenta de Google para subir tus fotos: sirve cualquier
        cuenta. La administración de la galería está reservada a los novios.
      </p>
    </div>
  );
}
