import { LoaderCircle } from "lucide-react";

export default function AdminLoading() {
  return (
    <main className="min-h-screen p-8 grid place-content-center">
      <LoaderCircle className="animate-spin size-30 stroke-1 text-accent-foreground" />
    </main>
  );
}
