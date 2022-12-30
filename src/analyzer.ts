import { NS } from '@ns';

export async function main(ns: NS) {
  const [targetServer] = ns.args.map((a) => a.toString());
  ns.tail();
  ns.disableLog('ALL');

  while (true) {
    ns.printf(
      'security=%d/%d\tmoney=%d/%d',
      ns.getServerSecurityLevel(targetServer),
      ns.getServerMinSecurityLevel(targetServer),
      ns.getServerMoneyAvailable(targetServer),
      ns.getServerMaxMoney(targetServer),
    );
    await ns.sleep(1000);
  }
}
