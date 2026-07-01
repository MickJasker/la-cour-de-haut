import { Logo } from "../ui/logo";

export function Footer() {
  return (
    <footer className="bg-brand-forest text-olive-50 flex flex-col items-center justify-center p-10 gap-10">
      <Logo className="w-100 max-w-full h-auto" />
      <address className="text-style-body-large text-center not-italic">
        4 Chem. des Rouillères
        <br />
        50520 Juvigny les Vallées
        <br />
        France
      </address>
    </footer>
  );
}
