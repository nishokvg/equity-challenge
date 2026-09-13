import snapshot from '@/data/northern-ca.json';
import type { Dataset } from '@/lib/audit';
import Workspace from '@/components/workspace';
export default function Home() {
  return <Workspace data={snapshot as Dataset} />;
}
