import { NS } from '@ns';

export default class ScriptRun {
  private readonly pid: number;
  private readonly ns: NS;
  private readonly script: string;
  private readonly hostname: string;
  private readonly threads: number;

  constructor(ns: NS, pid: number, script: string, threads: number, hostname: string) {
    this.ns = ns;
    this.pid = pid;
    this.script = script;
    this.threads = threads;
    this.hostname = hostname;
  }

  isRunning() {
    return this.ns.isRunning(this.pid);
  }

  ram() {
    const ram = this.ns.getScriptRam(this.script, this.hostname) * this.threads;

    if (this.hostname == 'home') {
      this.ns.printf(
        '%s@%s (%.2f or %.2f) * %d = %.2f',
        this.script,
        this.hostname,
        this.ns.getScriptRam(this.script, this.hostname),
        this.ns.getScriptRam(this.script),
        this.threads,
        ram,
      );

      if (this.ns.getScriptRam(this.script, this.hostname) == 0) {
        this.ns.tprintf('Script %s not found on %s!', this.script, this.hostname);
        this.ns.exit();
      }
    }

    return ram;
  }
}
