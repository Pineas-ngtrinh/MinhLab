import OrderTrackingPanel from './OrderTrackingPanel';

interface OrderTrackingPageProps {
  searchParams: Promise<{
    order?: string;
    token?: string;
  }>;
}

export default async function OrderTrackingPage({ searchParams }: OrderTrackingPageProps) {
  const params = await searchParams;
  return <OrderTrackingPanel orderNumber={params.order ?? ''} token={params.token ?? ''} />;
}
