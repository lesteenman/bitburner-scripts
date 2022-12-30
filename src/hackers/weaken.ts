import { NS } from '@ns';

export async function main(ns: NS) {
  const pid = ns.getRunningScript()?.pid;
  ns.tprintf('Schedule Weaken: %s, t=%d, pid=%d', ns.args, ns.getRunningScript()?.threads, pid);
  ns.printf('Weaken: %s', ns.args);
  const [target, delay, id] = ns.args.map((a) => a.toString());
  if (delay) await ns.sleep(parseInt(delay));
  ns.printf('Weakening, pid=%d, batch=%s', pid, id);
  await ns.weaken(target);
  ns.tprintf('Weaken done, pid=%d, batch=%s', pid, id);
}
