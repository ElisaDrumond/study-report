'use client';
import styles from '../../../app/page.module.css';
export default function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`${styles.field} ${wide ? styles.wide : ''}`}>
      {label}
      {children}
    </label>
  );
}