import "./globals.css";

export const metadata = {
  title: "SmartDoc AI | Enterprise 3-Tier Document Intelligence Platform",
  description: "Production-grade 3-tier microservice architecture for automated DevOps pipelines (Docker, Kubernetes, Prometheus, Redis, PostgreSQL).",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
