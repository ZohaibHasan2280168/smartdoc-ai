import "./globals.css";

export const metadata = {
  title: "SmartDoc AI | Enterprise Document Intelligence & Telemetry Platform",
  description: "Enterprise 3-tier microservice architecture for automated document ingestion, AI RAG inference, and cloud infrastructure telemetry.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0b0f19] text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
