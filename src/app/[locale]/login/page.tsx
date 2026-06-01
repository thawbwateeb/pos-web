import LoginForm from './LoginForm';

export default async function LoginPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{ next?: string }>;
  params: Promise<{ locale: string }>;
}) {
  const sp = await searchParams;
  const p = await params;
  return <LoginForm next={sp.next ?? `/${p.locale}/order`} />;
}
