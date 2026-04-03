import { Button } from "@/components/ui/button";
import { features, steps } from "./data/data";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="py-20 text-center">
        <div className="container max-w-4xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Agro-Avícola Conda Arriba {" "} <br />
            <span className="bg-linear-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">
              Avicon-Ia
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Subí, analizá y colaborá en documentos con tu organización.
            Obtené resúmenes e insights de IA al instante.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="px-8">
                Registrarse
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="px-8">
                Iniciar Sesión
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="container max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Todo lo que Necesitás
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-none shadow-sm">
                <CardHeader>
                  <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-lg mb-4">
                    <div className="text-blue-600">
                      {<feature.icon className="w-8 h-8" />}
                    </div>
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="container max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Cómo Funciona</h2>
          <div className="space-y-4 max-w-md mx-auto">
            {steps.map((step, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-white border rounded-lg"
              >
                <div className="shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <span className="font-medium">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-linear-to-r from-blue-50 to-indigo-50">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            ¿Listo para analizar tus documentos?
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Unite a miles de equipos que usan Avicont-IA para trabajar de forma
            más inteligente con sus documentos.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="px-8">
              Comenzá Gratis
            </Button>
          </Link>
          <p className="text-sm text-gray-500 mt-4">
            Sin tarjeta de crédito • 14 días de prueba gratis
          </p>
        </div>
      </section>
    </>
  );
}