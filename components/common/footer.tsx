export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted">
      <div className="px-4 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-muted-foreground text-sm">
          © {currentYear} Avicont-IA. Todos los derechos reservados.
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>Política de Privacidad</span>
          <span>Términos de Servicio</span>
          <span>Política de Cookies</span>
        </div>
      </div>
    </footer>
  );
}
