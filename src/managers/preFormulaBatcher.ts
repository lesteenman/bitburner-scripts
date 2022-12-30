import { NS } from '@ns';
import Manager from '@/managers/manager';
import getServers from '@/utilities/getServers';
import { Server } from '@/libs/server';
import constants from '@/libs/constants';
import PreFormulaServerPreparer from '@/managers/preFormulaServerPreparer';

export default class PreFormulaBatcher implements Manager {
  private readonly ns: NS;
  private readonly batchSettings: BatchSettings;
  private readonly batches: Array<Batch>;
  private readonly targetServer: Server;
  private servers: Array<Server>;
  private trainer: Trainer;
  private lastBatchStartTime = 0;
  private lastHackingLevel = 0;

  constructor(ns: NS, hostname: string, hackPercentagePerBatch: number) {
    this.ns = ns;
    this.targetServer = new Server(ns, hostname);
    this.batchSettings = new BatchSettings(ns, this.targetServer, hackPercentagePerBatch);
    this.batches = new Array<Batch>();
    this.servers = new Array<Server>();
    // this.trainer = new WeakenTrainer(ns, "joesguns");
    this.trainer = new DummyTrainer();
  }

  async run() {
    this.ns.disableLog('ALL');
    await this.updateServers();
    this.lastHackingLevel = this.ns.getHackingLevel();

    if (!(this.targetServer.isAtMinSecurity() && this.targetServer.isAtMaxMoney())) {
      this.ns.tprintf('Preparing server %s', this.targetServer.hostname);
      const preparer = new PreFormulaServerPreparer(this.ns, this.targetServer, this.servers);
      await preparer.run();
    }

    // this.ns.tprintf('all servers: %s', this.servers.map((s) => `${s.hostname} (${s.availableRam()} gb)`).join('\n'));
    // this.ns.tprintf('total ram: %d', this.totalAvailableRam());
    // this.ns.tprintf('target server: %s', this.targetServer.toString());

    this.batchSettings.prepare();
    this.ns.tprintf(
      'BatchSettings: %s, required = %d',
      this.batchSettings.toString(),
      this.batchSettings.getRequiredRam(),
    );

    await this.prepareBatches();
    this.ns.tprintf('Batches prepped: %s', this.batches.map((b) => b.toString()).join('\n'));

    // noinspection InfiniteLoopJS
    while (true) {
      // this.ns.printf('HGWLoop, batches = %s', this.batches.map((b) => b.toString()).join('\n'));
      await this.hwgwLoop();
      await this.ns.sleep(5000);
    }
  }

  async hwgwLoop() {
    if (this.lastHackingLevel != this.ns.getHackingLevel()) {
      throw new Error('Not yet implemented: update after hacking level change!');
    }
    // this.updateServers();

    // if (this.canSpawnAdditionalBatch()) {
    //   if (this.trainer.isRunning()) {
    //     this.trainer.stop();
    //   } else {
    //     this.addBatch();
    //   }
    // }

    // if (!this.trainer.isRunning() && !this.canSpawnAdditionalBatch()) {
    //   this.trainer.start();
    // }

    if (Date.now() - this.lastBatchStartTime > this.batchSettings.timeBetweenBatchStarts) {
      const freeBatch = this.batches.find((b) => !b.isRunning());
      if (freeBatch) {
        freeBatch.start();
        this.lastBatchStartTime = Date.now();
      }
    }
  }

  private canSpawnAdditionalBatch() {
    const totalAvailableRam = this.totalAvailableRam();
    const ramPerBatch = this.batchSettings.getRequiredRam();

    return Math.floor(totalAvailableRam / ramPerBatch) > this.batches.length;
  }

  private totalAvailableRam() {
    return Array.from(this.servers)
      .map((s) => s.availableRam())
      .reduce((a, b) => a + b, 0);
  }

  private async prepareBatches() {
    while (this.canSpawnAdditionalBatch()) {
      this.batches.push(Batch.plan(this.ns, this.servers, this.batchSettings));
    }

    if (this.batches.length == 0) {
      throw new Error('No batches made! Required = ' + this.batchSettings.getRequiredRam());
    }
  }

  private async updateServers() {
    // Todo
    if (this.servers.length) return;

    this.servers = (await getServers(this.ns))
      .filter((h) => this.ns.hasRootAccess(h))
      .map((h) => (h == this.targetServer.hostname ? this.targetServer : new Server(this.ns, h)));

    for (const server of this.servers) {
      server.scp(['/hackers/weaken.js', '/hackers/grow.js', '/hackers/hack.js']);
    }
  }

  // private addBatch() {
  //   this.batches.push(Batch.from(this.ns, this.batchSettings));
  // }

  // private updateServers() {
  //   for (const hostname of getServers(this.ns)) {
  //     let server = this.servers.get(hostname);
  //     const serverInfo = this.ns.getServer(hostname);
  //     if (server) {
  //       if (server.maxRam != serverInfo.maxRam) {
  //         server.maxRam = serverInfo.maxRam;
  //       }
  //     } else {
  //       server = new Server(this.ns, hostname);
  //     }
  //   }
  // }
}

class BatchSettings {
  public targetServer: Server;
  public hackThreads = -1;
  public growThreads = -1;
  public postGrowWeakenThreads = -1;
  public postHackWeakenThreads = -1;
  private ns: NS;
  readonly timeBetweenBatchStarts = 4 * 500;
  readonly taskGap = 500;
  private readonly hackPercentage: number;

  constructor(ns: NS, hostname: Server, hackPercentage: number) {
    this.ns = ns;
    this.targetServer = hostname;
    this.hackPercentage = hackPercentage;
  }

  toString() {
    return JSON.stringify(this.toJson(), null, 2);
  }

  private toJson() {
    return {
      targetServer: this.targetServer.toJson(),
      hackThreads: this.hackThreads,
      postHackWeakenThreads: this.postHackWeakenThreads,
      growThreads: this.growThreads,
      postGrowWeakenThreads: this.postGrowWeakenThreads,
      timeBetweenBatchStarts: this.timeBetweenBatchStarts,
      hackPercentage: this.hackPercentage,
      ramRequired: this.getRequiredRam(),
    };
  }

  public prepare() {
    if (this.targetServer.minSecurityLevel() != this.targetServer.securityLevel()) {
      throw new Error('Server was not prepared: not at min security');
    }

    if (this.targetServer.maxMoney() != this.targetServer.currentMoney()) {
      throw new Error('Server was not prepared: not at max money');
    }

    const hostname = this.targetServer.hostname;
    const amount = (this.hackPercentage / 100) * this.ns.getServerMaxMoney(hostname);
    this.hackThreads = Math.floor(this.ns.hackAnalyzeThreads(hostname, amount));

    const growFactor = this.targetServer.currentMoney() / (this.targetServer.currentMoney() - amount);
    this.growThreads = Math.ceil(this.ns.growthAnalyze(hostname, growFactor));

    this.postHackWeakenThreads = Math.ceil(
      this.ns.hackAnalyzeSecurity(this.hackThreads) / constants.SECURITY_DECREASE_PER_WEAKEN,
    );
    this.postGrowWeakenThreads = Math.ceil(
      this.ns.growthAnalyzeSecurity(this.growThreads) / constants.SECURITY_DECREASE_PER_WEAKEN,
    );

    // this.ns.tprintf(
    //   JSON.stringify(
    //     {
    //       amount: amount,
    //       growFactor: growFactor,
    //       hackThreads: this.hackThreads,
    //       hackImpact: this.ns.hackAnalyzeSecurity(this.hackThreads),
    //       growThreads: this.growThreads,
    //       growImpact: this.ns.growthAnalyzeSecurity(this.growThreads),
    //       postHackWeakenThreads: this.postHackWeakenThreads,
    //       postGrowWeakenThreads: this.postGrowWeakenThreads,
    //     },
    //     null,
    //     2,
    //   ),
    // );
  }

  getRequiredRam() {
    return (
      this.ns.getScriptRam(constants.HACK_SCRIPT) * this.hackThreads +
      this.ns.getScriptRam(constants.GROW_SCRIPT) * this.growThreads +
      this.ns.getScriptRam(constants.WEAKEN_SCRIPT) * this.postGrowWeakenThreads +
      this.ns.getScriptRam(constants.WEAKEN_SCRIPT) * this.postHackWeakenThreads
    );
  }
}

class Batch {
  private ns: NS;
  private hackThreads: Array<Runnable>;
  private growThreads: Array<Runnable>;
  private postHackWeakenThreads: Array<Runnable>;
  private pids: Array<number>;
  private postGrowthWeakenThreads: Array<Runnable>;
  private id: string;
  private static batchId = 0;
  private taskGap: number;
  private targetServer: Server;

  constructor(
    ns: NS,
    id: string,
    targetServer: Server,
    taskGap: number,
    hackThreads: Array<Runnable>,
    growThreads: Array<Runnable>,
    weakenThreads: Array<Runnable>,
    postGrowthWeakenThreads: Array<Runnable>,
  ) {
    this.ns = ns;
    this.id = id;
    this.targetServer = targetServer;
    this.taskGap = taskGap;
    this.hackThreads = hackThreads;
    this.growThreads = growThreads;
    this.postHackWeakenThreads = weakenThreads;
    this.postGrowthWeakenThreads = postGrowthWeakenThreads;
    this.pids = [];
  }

  toString() {
    return JSON.stringify(
      {
        id: this.id,
        hackThreads: this.hackThreads.map((r) => r.toJson()),
        postHackWeakenThreads: this.postHackWeakenThreads.map((r) => r.toJson()),
        growThreads: this.growThreads.map((r) => r.toJson()),
        postGrowWeakenThreads: this.postGrowthWeakenThreads.map((r) => r.toJson()),
        pids: this.pids,
      },
      null,
      2,
    );
  }

  isRunning() {
    return this.pids.some((pid) => this.ns.isRunning(pid));
  }

  static plan(ns: NS, servers: Array<Server>, batchSettings: BatchSettings): Batch {
    const hackThreads = this.reserveThreads(ns, constants.HACK_SCRIPT, batchSettings.hackThreads, servers);

    const postHackWeakenThreads = this.reserveThreads(
      ns,
      constants.WEAKEN_SCRIPT,
      batchSettings.postHackWeakenThreads,
      servers,
    );

    const growThreads = this.reserveThreads(ns, constants.GROW_SCRIPT, batchSettings.growThreads, servers);

    const postGrowthWeakenThreads = this.reserveThreads(
      ns,
      constants.WEAKEN_SCRIPT,
      batchSettings.postGrowWeakenThreads,
      servers,
    );

    return new Batch(
      ns,
      `batch-${this.batchId++}`,
      batchSettings.targetServer,
      batchSettings.taskGap,
      hackThreads,
      growThreads,
      postHackWeakenThreads,
      postGrowthWeakenThreads,
    );
  }

  private static reserveThreads(ns: NS, script: string, totalThreads: number, servers: Array<Server>) {
    const threads = new Array<Runnable>();
    const ram = ns.getScriptRam(script);

    let threadsLeft = totalThreads;
    for (const server of servers) {
      const plannableThreads = Math.min(threadsLeft, server.getAvailableThreads(script));
      if (plannableThreads > 0) {
        threadsLeft -= plannableThreads;
        server.reserve(ram);
        ns.tprintf('Setting %s to %d', server.hostname, plannableThreads);
        threads.push(new Runnable(server, plannableThreads, script));
      }

      if (threadsLeft == 0) {
        break;
      }
    }
    if (threadsLeft > 0) {
      throw new Error('ERROR: could not plan all threads!');
    }

    return threads;
  }

  start() {
    // Order they should finish in: hack, postHackWeaken, grow, postGrowWeaken
    // Order of duration: weaken (4x), grow (3.2x), hack (1x).
    if (!(this.targetServer.isAtMinSecurity() && this.targetServer.isAtMaxMoney())) {
      throw new Error('Server is not prepared, can not start a batch!');
    }

    this.ns.tprintf('starting batch %s', this.id);

    const weakenDuration = Math.ceil(this.ns.getWeakenTime(this.targetServer.hostname));
    const growDuration = Math.ceil(this.ns.getGrowTime(this.targetServer.hostname));
    const hackDuration = Math.ceil(this.ns.getHackTime(this.targetServer.hostname));
    this.ns.tprintf('weakenDuration = %d', weakenDuration);
    this.ns.tprintf('growDuration = %d', growDuration);
    this.ns.tprintf('hackDuration = %d', hackDuration);

    const hackDelay = weakenDuration - hackDuration - this.taskGap;
    const postHackWeakenDelay = 0;

    const growDelay = weakenDuration + this.taskGap - growDuration;
    const postGrowWeakenDelay = this.taskGap * 2;

    // TEST
    const hackEnd = hackDelay + hackDuration;
    const postHackWeakenEnd = postHackWeakenDelay + weakenDuration;
    const growEnd = growDelay + growDuration;
    const postGrowWeakenEnd = postGrowWeakenDelay + weakenDuration;

    this.ns.tprintf('h1, start=%d, end=%d', hackDelay, hackEnd);
    this.ns.tprintf('w1, start=%d, end=%d', postHackWeakenDelay, postHackWeakenEnd);
    this.ns.tprintf('g1, start=%d, end=%d', growDelay, growEnd);
    this.ns.tprintf('w2, start=%d, end=%d', postGrowWeakenDelay, postGrowWeakenEnd);

    if (postHackWeakenEnd - hackEnd != this.taskGap) {
      throw new Error(`Bad timing on hack <=> w1: ${postHackWeakenEnd} - ${hackEnd} != ${this.taskGap}`);
    }

    if (growEnd - postHackWeakenEnd != this.taskGap) {
      throw new Error(`Bad timing on w1 <=> grow: ${growEnd} - ${postHackWeakenEnd} != ${this.taskGap}`);
    }

    if (postGrowWeakenEnd - growEnd != this.taskGap) {
      throw new Error(`Bad timing on grow <=> w2: ${postGrowWeakenEnd} - ${growEnd} != ${this.taskGap}`);
    }

    for (const r of this.hackThreads) {
      const pid = r.run(this.ns, this.targetServer.hostname, hackDelay, this.id);
      this.pids.push(pid);
    }

    for (const r of this.postHackWeakenThreads) {
      const pid = r.run(this.ns, this.targetServer.hostname, postHackWeakenDelay, this.id);
      this.pids.push(pid);
    }

    for (const r of this.growThreads) {
      const pid = r.run(this.ns, this.targetServer.hostname, growDelay, this.id);
      this.pids.push(pid);
    }

    for (const r of this.postGrowthWeakenThreads) {
      const pid = r.run(this.ns, this.targetServer.hostname, postGrowWeakenDelay, this.id);
      this.pids.push(pid);
    }

    this.ns.tprintf('PIDs: %s, %s', this.pids, this.isRunning());
  }
}

class Runnable {
  server: Server;
  numThreads: number;
  script: string;

  constructor(server: Server, threads: number, script: string) {
    this.server = server;
    this.numThreads = threads;
    this.script = script;
  }

  toString() {
    return JSON.stringify(this.toJson());
  }

  toJson() {
    return {
      server: this.server.hostname,
      threads: this.numThreads,
      script: this.script,
    };
  }

  run(ns: NS, ...args: Array<string | number>): number {
    return ns.exec(this.script, this.server.hostname, this.numThreads, ...args);
  }
}

interface Trainer {
  isRunning(): boolean;

  start(): void;

  stop(): void;
}

// class WeakenTrainer implements Trainer {
//   private ns: NS;
//   private hostname: string;
//   private pid: number;
//   constructor(ns: NS, hostname: string) {
//     this.ns = ns;
//     this.hostname = hostname;
//     this.pid = -1;
//   }
//
//   isRunning() {
//     return this.pid > 0 && this.ns.isRunning(this.pid);
//   }
//
//   start() {
//
//   }
//
//   stop() {
//     // TODO: Implement
//   }
// }

class DummyTrainer implements Trainer {
  isRunning(): boolean {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  start(): void {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  stop(): void {}
}
