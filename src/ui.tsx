import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';

export function Button({ variant = 'primary', size = 'md', children, ...props }: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 cursor-pointer rounded-lg font-[family-name:var(--font-ui)] disabled:opacity-40 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary: `bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:scale-[0.98]`,
    secondary: `bg-transparent text-[var(--accent-text)] border border-[var(--accent)] hover:bg-[var(--accent-light)]`,
    ghost: `bg-transparent text-[var(--text-1)] hover:bg-[var(--bg-2)] active:bg-[var(--bg-3)]`,
    danger: `bg-[var(--error)] text-white hover:opacity-90 active:scale-[0.98]`,
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return <button className={`${base} ${variants[variant]} ${sizes[size]}`} {...props}>{children}</button>;
}

export function Card({ children, className = '', hover = false, onClick }: { children: ReactNode; className?: string; hover?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`bg-[var(--bg-1)] border border-[var(--border-0)] rounded-xl ${hover ? 'hover:border-[var(--border-1)] transition-colors duration-150 cursor-pointer' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'accent' | 'success' | 'warning' | 'error' }) {
  const variants: Record<string, string> = {
    default: 'bg-[var(--bg-2)] text-[var(--text-2)]',
    accent: 'bg-[var(--accent-light)] text-[var(--accent-text)]',
    success: 'bg-[var(--success-light)] text-[var(--success)]',
    warning: 'bg-[var(--warning-light)] text-[var(--warning)]',
    error: 'bg-[var(--error-light)] text-[var(--error)]',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${variants[variant]}`}>{children}</span>;
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1 rounded-full bg-[var(--bg-3)] overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500 ease-out" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Input({ ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full px-3 py-2 rounded-lg border border-[var(--border-1)] bg-[var(--bg-0)] text-[var(--text-0)] text-sm placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors duration-150 outline-none font-[family-name:var(--font-ui)]"
      {...props}
    />
  );
}

export function TextArea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="w-full px-3 py-2 rounded-lg border border-[var(--border-1)] bg-[var(--bg-0)] text-[var(--text-0)] text-sm placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors duration-150 outline-none resize-none"
      {...props}
    />
  );
}
