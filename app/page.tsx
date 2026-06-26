import HomePageClient from "@/components/HomePageClient";

interface HomeProps {
  searchParams: Promise<{
    lang?: string | string[];
  }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const language = params.lang === "en" ? "en" : "zh";

  return <HomePageClient initialLanguage={language} />;
}
