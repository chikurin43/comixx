import ClientPage from "./page.client";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function Page({ params }: Props) {
  const resolved = await params;
  return <ClientPage params={resolved} />;
}

