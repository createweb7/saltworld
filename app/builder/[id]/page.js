import BuilderClient from './BuilderClient';

export default async function BuilderPage({ params }) {
  const { id } = await params;
  return <BuilderClient pageId={id} />;
}
