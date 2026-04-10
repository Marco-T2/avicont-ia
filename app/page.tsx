import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Handshake, Eye } from "lucide-react";
import Footer from "@/components/common/footer";

export default function Home() {
  return (
    <section className="min-h-full flex flex-col overflow-y-auto bg-gradient-to-b from-emerald-50 via-white to-white">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:py-20 flex-1">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left column — institutional content */}
          <div className="order-2 lg:order-1">
            <Badge className="mb-4 bg-emerald-100 text-emerald-800 uppercase tracking-widest text-[10px] font-semibold border-emerald-200">
              Asociación Avicola
            </Badge>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-emerald-900 mb-4">
              Asociación Agro-Avícola Conda Arriba
            </h1>

            <p className="text-base md:text-lg text-gray-600 mb-8 max-w-lg">
              Acompañamos a nuestros socios con
              herramientas y apoyo integral para fortalecer su actividad
              productiva y comercial.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card size="sm">
                <CardContent className="flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                    <Handshake className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900">Misión</p>
                    <p className="text-xs text-gray-500 mt-1">
                      La asociación tiene como misión fortalecer a sus asociados dedicados a la crianza y comercialización de pollo, brindándoles representación organizativa y apoyo en la gestión productiva y administrativa de su actividad avícola
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card size="sm">
                <CardContent className="flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                    <Eye className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900">Visión</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Su visión es ser una asociación de referencia en el departamento de Cochabamba dentro del sector avícola, siendo reconocida por su transparencia en la administración de recursos, su capacidad de organización y el apoyo constante a sus socios para impulsar una producción sostenible
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right column — image placeholder */}
          <div className="order-1 lg:order-2">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl ring-1 ring-emerald-200/60">
              <Image
                src="/farm.webp"
                alt="Granja Avícola"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </section>
  );
}
