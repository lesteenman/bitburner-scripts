import { NS } from '@ns';

export default function getAvailableMoney(ns: NS): number {
  let money = ns.getPlayer().money;

  const hackingLevel = ns.getHackingLevel();
  if (hackingLevel > 50 && !ns.fileExists('brutessh.exe')) {
    money -= 50000;
  }

  return money;
}
