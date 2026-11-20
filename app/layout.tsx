import './globals.css';
export const metadata = {
  title: 'Study & Work | Reports Financeiros',
  description: 'Gerenciador local de reports financeiros',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
