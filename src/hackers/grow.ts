import { NS } from '@ns';

export async function main(ns: NS) {
  const pid = ns.getRunningScript()?.pid;
  ns.tprintf('Schedule Grow: %s, t=%d, pid=%d', ns.args, ns.getRunningScript()?.threads, pid);
  ns.printf('Grow: %s', ns.args);
  const [target, delay, id] = ns.args.map((a) => a.toString());
  if (delay) await ns.sleep(parseInt(delay));
  ns.printf('Growing, pid=%d, batch=%s', pid, id);
  await ns.grow(target);
  ns.tprintf('Grow done, pid=%d, batch=%s', pid, id);
}
