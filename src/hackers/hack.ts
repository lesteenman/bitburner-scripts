import { NS } from '@ns';

export async function main(ns: NS) {
  const pid = ns.getRunningScript()?.pid;
  ns.tprintf('Schedule Hack: %s, t=%d, pid=%d', ns.args, ns.getRunningScript()?.threads, pid);
  ns.printf('Hack: %s', ns.args);
  const [target, delay, id] = ns.args.map((a) => a.toString());
  if (delay) await ns.sleep(parseInt(delay));
  ns.printf('Hacking, pid=%d, batch=%s', pid, id);
  await ns.hack(target);
  ns.tprintf('Hack done, pid=%d, batch=%s', pid, id);
}
