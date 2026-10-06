import "./globals.css";

export const metadata = {
  title: "SmartDoc AI | Enterprise Document Intelligence & Telemetry Platform",
  description: "Enterprise 3-tier microservice architecture for automated document ingestion, AI RAG inference, and cloud infrastructure telemetry.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-800">
        {children}
      </body>
    </html>
  );
}
