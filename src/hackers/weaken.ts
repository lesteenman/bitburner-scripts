import { NS } from '@ns';

export async function main(ns: NS) {
  const [target] = ns.args.toString();
  await ns.weaken(target);
}
