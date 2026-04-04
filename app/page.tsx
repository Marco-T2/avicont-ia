import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <section className="flex-1 flex items-center justify-center px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-4">
          AGRO-AVICOLA CONDA ARRIBA
        </h1>
        <p className="text-lg md:text-xl font-medium text-gray-700 mb-4">
          Sistema de Gestion Integral para Productores Avicolas
        </p>
        <p className="text-base text-gray-500 mb-8 max-w-xl mx-auto">
          Apoyamos a nuestros socios con herramientas modernas para la gestion
          administrativa, contable y comercial de su actividad productiva.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/sign-up">
            <Button size="lg" className="px-8 w-full sm:w-auto">
              Registrarse
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button
              size="lg"
              variant="outline"
              className="px-8 w-full sm:w-auto"
            >
              Iniciar Sesion
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
