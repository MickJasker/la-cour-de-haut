import { Header } from "@/components/sections/header";
import { Hero } from "@/components/sections/hero";

export default async function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <div className="h-22" />
      </main>
    </>
  );
}
