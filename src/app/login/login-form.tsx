'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import styles from './login-form.module.css';

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
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
      <button
        className="btn btn-primary"
        type="button"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? 'Redirigiendo a Google…' : 'Continuar con Google'}
      </button>

      <p className={styles.hint}>
        Solo puede entrar la cuenta de Google que contiene la carpeta de fotos.
      </p>
    </div>
  );
}
