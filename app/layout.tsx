import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/components/common/header";
import Footer from "@/components/common/footer";
import { Toaster } from "sonner";
import { esES } from "@clerk/localizations";//Modificar el idioma a español

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
    <ClerkProvider localization={esES}>
      <html lang="es" suppressHydrationWarning>
        <body className={inter.className}>
          <div className="h-screen flex flex-col">
            <Header />
            <main className="flex-1 overflow-y-auto pt-16">{children}</main>
            <Footer />
            <Toaster position="top-right" richColors />
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}