import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/** Moldura das telas de Login/Cadastro; quem já está logado volta para o app. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const { status } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  if (status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1 className="header__title auth-card__brand">
          Pitica Study <Heart fill="currentColor" size={24} />
        </h1>
        <h2 className="auth-card__title">{title}</h2>
        <p className="auth-card__subtitle">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
