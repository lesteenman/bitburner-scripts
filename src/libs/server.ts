import { NS } from '@ns';
import ScriptRun from '@/managers/scriptRun';
import constants from '@/libs/constants';
import getAvailableMoney from '@/utilities/getAvailableMoney';

export class Server {
  private ns: NS;
  public hostname: string;
  private readonly maxRam: number;
  private reservedRam: number;

  private weakens: Array<ScriptRun>;
  private hacks: Array<ScriptRun>;
  private grows: Array<ScriptRun>;

  constructor(ns: NS, hostname: string) {
    this.ns = ns;
    this.hostname = hostname;
    this.maxRam = ns.getServerMaxRam(hostname);
    // this.reservedRam = ns.getServerUsedRam(hostname) + (hostname == 'home' ? 1024 : 0);
    this.reservedRam = ns.getServerUsedRam(hostname);
    this.weakens = new Array<ScriptRun>();
    this.hacks = new Array<ScriptRun>();
    this.grows = new Array<ScriptRun>();
  }

  toString() {
    // return JSON.stringify({
    //   hostname: this.hostname,
    //   maxRam: this.maxRam,
    //   reservedRam: this.reservedRam,
    //   maxMoney: this.maxMoney(),
    //   currentMoney: this.currentMoney(),
    //   minSecurityLevel: this.minSecurityLevel(),
    //   currentSecurityLevel: this.securityLevel(),
    // });
    return JSON.stringify(this.toJson(), null, 2); //`${this.hostname}:
    // maxRam: ${this.maxRam}
    // reservedRam: ${this.reservedRam}
    // maxMoney: ${this.maxMoney()}
    // currentMoney: ${this.currentMoney()}
    // minSecurityLevel: ${this.minSecurityLevel()}
    // currentSecurityLevel: ${this.securityLevel()}`;
  }

  toJson() {
    return {
      hostname: this.hostname,
      maxRam: this.maxRam,
      reservedRam: this.reservedRam,
      maxMoney: this.maxMoney(),
      currentMoney: this.currentMoney(),
      minSecurityLevel: this.minSecurityLevel(),
      currentSecurityLevel: this.securityLevel(),
    };
  }

  checkPids() {
    this.weakens = this.weakens.filter((sr) => sr.isRunning());
    this.hacks = this.hacks.filter((sr) => sr.isRunning());
    this.grows = this.grows.filter((sr) => sr.isRunning());
  }

  availableRam() {
    this.checkPids();
    const usedRam =
      this.hacks.map((sr) => sr.ram()).reduce((a, b) => a + b, 0) +
      this.grows.map((sr) => sr.ram()).reduce((a, b) => a + b, 0) +
      this.weakens.map((sr) => sr.ram()).reduce((a, b) => a + b, 0);

    // if (this.hostname == 'home') {
    //   this.ns.printf(
    //     `used ram on %s is %.2f; ${this.hacks.length} hacks, ${this.grows.length} grows and ${this.weakens.length} weakens; Reserved=%.2f, so total available=%.2f`,
    //     this.hostname,
    //     usedRam,
    //     this.reservedRam,
    //     this.maxRam - this.reservedRam - usedRam,
    //   );
    // }
    return this.maxRam - this.reservedRam - usedRam;
  }

  getAvailableThreads(script: string) {
    return Math.floor(this.availableRam() / this.ns.getScriptRam(script));
  }

  reserve(amount: number) {
    if (amount > this.maxRam - this.reservedRam) {
      throw new Error('Attempting to reserve more than the available amount of ram on ' + this.hostname);
    }

    // if (this.hostname == 'home') {
    //   this.ns.printf('Reserving %d on %s', amount, this.hostname);
    // }

    this.reservedRam += amount;
  }

  isAtMinSecurity() {
    // this.ns.printf(
    //   'current=%.2f min=%.2f => %s',
    //   this.securityLevel(),
    //   this.minSecurityLevel(),
    //   this.securityLevel() - this.minSecurityLevel() <= 0.05,
    // );
    return this.securityLevel() - this.minSecurityLevel() <= 0.05;
  }

  isAtMaxMoney() {
    // this.ns.printf(
    //   'current=%d (%s), max=%d (%s) => %s',
    //   this.currentMoney(),
    //   typeof this.currentMoney(),
    //   this.maxMoney(),
    //   typeof this.maxMoney(),
    //   this.currentMoney() == this.maxMoney(),
    // );
    return this.currentMoney() == this.maxMoney();
  }

  securityLevel() {
    return this.ns.getServerSecurityLevel(this.hostname);
  }

  minSecurityLevel() {
    return this.ns.getServerMinSecurityLevel(this.hostname);
  }

  currentMoney() {
    return this.ns.getServerMoneyAvailable(this.hostname);
  }

  maxMoney() {
    return this.ns.getServerMaxMoney(this.hostname);
  }

  threadsToWeakenToMin() {
    return Math.ceil((this.securityLevel() - this.minSecurityLevel()) / constants.SECURITY_DECREASE_PER_WEAKEN);
  }

  startWeakens(target: string, threads: number, delay = 0) {
    const run = this.run(constants.WEAKEN_SCRIPT, threads, [target, delay]);
    this.weakens.push(run);
  }

  startGrows(target: string, threads: number, delay = 0) {
    const run = this.run(constants.GROW_SCRIPT, threads, [target, delay]);
    this.grows.push(run);
  }

  startHack(target: string, threads: number, delay = 0) {
    const run = this.run(constants.HACK_SCRIPT, threads, [target, delay]);
    this.hacks.push(run);
  }

  private run(script: string, threads: number, args: Array<string | number>) {
    const pid = this.ns.exec(script, this.hostname, threads, ...args);
    return new ScriptRun(this.ns, pid, script, threads, this.hostname);
  }

  scp(scripts: string[]) {
    this.ns.scp(scripts, this.hostname, 'home');
  }
}
