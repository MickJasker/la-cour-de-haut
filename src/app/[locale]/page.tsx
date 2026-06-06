interface Props {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;

  return (
    <main>
      <h1>La Cour de Haut</h1>
      <p>locale: {locale}</p>
    </main>
  );
}
