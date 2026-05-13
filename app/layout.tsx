import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/components/common/header";
import { Toaster } from "sonner";
import { esES } from "@clerk/localizations";//Modificar el idioma a español
import { ThemeProvider } from "@/components/theme/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Avicont-Ai Sistema Contable Avicola",
  description: "Asociación Mixta de Productores Agro-Avícola Conda Arriba",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      localization={esES}
      signInFallbackRedirectUrl="/select-org"
      signUpFallbackRedirectUrl="/select-org"
    >
      <html lang="es" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider>
            <div className="flex flex-col h-screen overflow-hidden">
              <Header />
              <div className="flex-1 min-h-0 flex flex-col">
                {children}
              </div>
              <Toaster position="top-right" richColors />
            </div>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}