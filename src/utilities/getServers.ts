import { NS } from '@ns';

export default async function getServers(ns: NS): Promise<Array<string>> {
  return recursiveScan(ns, '', 'home');
}

function recursiveScan(ns: NS, parent: string, target: string) {
  const servers = Array.of(target);

  for (const host of ns.scan(target).filter((h) => h != parent)) {
    servers.push(...recursiveScan(ns, target, host));
  }

  return servers;
}
