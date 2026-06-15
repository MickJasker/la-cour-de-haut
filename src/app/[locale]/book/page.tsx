import { BookForm } from "@/components/sections/book-form";
import { Header } from "@/components/sections/header";

export default function BookPage() {
  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center p-6">
        <BookForm />
      </main>
    </>
  );
}
