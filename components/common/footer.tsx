export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-gray-50">
      <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-gray-600 text-sm">
          © {currentYear} Avicont-IA. Todos los derechos reservados.
        </div>
        <div className="flex gap-6 text-sm text-gray-500">
          <span>Política de Privacidad</span>
          <span>Términos de Servicio</span>
          <span>Política de Cookies</span>
        </div>
      </div>
    </footer>
  );
}
