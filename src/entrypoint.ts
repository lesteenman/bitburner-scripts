import { NS } from '@ns';
import PreFormulaBatcher from '@/managers/preFormulaBatcher';
import getServers from '@/utilities/getServers';

export async function main(ns: NS) {
  const targetServer = await getJuiciestTarget(ns);
  if (targetServer == undefined) {
    throw new Error('No target server found');
  }

  ns.run('analyzer.js', 1, targetServer);

  const manager = new PreFormulaBatcher(ns, targetServer, 10);
  await manager.run();
}

async function getJuiciestTarget(ns: NS) {
  let target;
  let bestValue = 0;

  const hostnames = (await getServers(ns)).filter((h) => ns.hasRootAccess(h));

  for (const hostname of hostnames) {
    const value = ns.getServerMaxMoney(hostname) / ns.getServerMinSecurityLevel(hostname);
    if (value > bestValue) {
      bestValue = value;
      target = hostname;
    }
  }

  return target;
}
