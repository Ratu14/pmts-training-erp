import { getAccessContext } from '@/lib/access';

export async function GET(request: Request) {
  const context = await getAccessContext(request);
  if (!context.configured) {
    return Response.json(
      { ...context, error: 'Cloudflare Access has not been configured for this ERP.' },
      { status: 503 },
    );
  }
  if (!context.authenticated) {
    return Response.json(
      { ...context, error: 'Cloudflare Access sign-in is required.' },
      { status: 401 },
    );
  }
  return Response.json(context);
}
