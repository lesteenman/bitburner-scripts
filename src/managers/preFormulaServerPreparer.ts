import { NS } from '@ns';
import { Server } from '@/libs/server';
import constants from '@/libs/constants';

export default class PreFormulaServerPreparer {
  private ns: NS;
  private targetServer: Server;
  private servers: Array<Server>;

  constructor(ns: NS, targetServer: Server, servers: Array<Server>) {
    this.ns = ns;
    this.targetServer = targetServer;
    this.servers = servers;
  }

  async run() {
    this.ns.disableLog('ALL');
    this.ns.printf('Preparing server %s', this.targetServer.hostname);

    while (!this.isPrepared()) {
      await this.preparationLoop();
      await this.ns.sleep(200);
    }
  }

  private isPrepared() {
    return this.targetServer.isAtMaxMoney() && this.targetServer.isAtMinSecurity();
  }

  private readonly MIN_GROW_FACTOR = 1.01;

  private async preparationLoop() {
    if (!this.targetServer.isAtMinSecurity()) {
      let requiredWeakens = this.targetServer.threadsToWeakenToMin();
      const weakenTime = this.ns.getWeakenTime(this.targetServer.hostname);

      for (const server of this.servers.filter((s) => s.getAvailableThreads(constants.WEAKEN_SCRIPT))) {
        const threads = Math.min(requiredWeakens, server.getAvailableThreads(constants.WEAKEN_SCRIPT));
        requiredWeakens -= threads;
        server.startWeakens(this.targetServer.hostname, threads);

        if (requiredWeakens <= 0) {
          break;
        }
      }

      this.ns.printf('Weakening and sleeping for %.2ds', weakenTime / 1000);
      await this.ns.sleep(weakenTime);
      return;
    }

    if (!this.targetServer.isAtMaxMoney()) {
      this.ns.print('Server is not at max money, growing and if possible weakening');

      const availableGrowThreads = this.servers
        .map((s) => s.getAvailableThreads(constants.GROW_SCRIPT))
        .reduce((a, b) => a + b, 0);

      let targetMultiplier = Math.max(
        this.MIN_GROW_FACTOR,
        1 + (this.targetServer.maxMoney() - this.targetServer.currentMoney()) / this.targetServer.currentMoney(),
      );
      this.ns.printf('Optimal grow multiplier: %.3f', targetMultiplier);

      let requiredGrows = this.ns.growthAnalyze(this.targetServer.hostname, targetMultiplier);
      while (requiredGrows > availableGrowThreads && targetMultiplier > 1.01) {
        targetMultiplier = targetMultiplier * 0.95;
        requiredGrows = this.ns.growthAnalyze(this.targetServer.hostname, targetMultiplier);
        this.ns.printf('Trying targetMultiplier %.2f => %d', targetMultiplier, requiredGrows);
      }

      this.ns.printf('Going to (try to) grow by %.2fx, requiring %d threads', targetMultiplier, requiredGrows);

      let requiredWeakens = Math.ceil(
        this.ns.growthAnalyzeSecurity(requiredGrows, this.targetServer.hostname) /
          constants.SECURITY_DECREASE_PER_WEAKEN,
      );
      let sleepTime = this.ns.getGrowTime(this.targetServer.hostname);
      for (const server of this.servers.filter((s) => s.getAvailableThreads(constants.GROW_SCRIPT))) {
        const threads = Math.min(requiredGrows, server.getAvailableThreads(constants.GROW_SCRIPT));
        requiredGrows -= threads;
        server.startGrows(this.targetServer.hostname, threads);

        if (requiredGrows <= 0) {
          break;
        }
      }

      const serversWithWeakenCapacity = this.servers.filter((s) => s.getAvailableThreads(constants.WEAKEN_SCRIPT));
      if (serversWithWeakenCapacity.length) {
        this.ns.printf(
          'Also have some weakening capacity. Sleeping for %ds instead of %ds',
          this.ns.getWeakenTime(this.targetServer.hostname) / 1000,
          sleepTime / 1000,
        );
        sleepTime = this.ns.getWeakenTime(this.targetServer.hostname);
        for (const server of serversWithWeakenCapacity) {
          const threads = Math.min(requiredWeakens, server.getAvailableThreads(constants.WEAKEN_SCRIPT));
          requiredWeakens -= threads;
          server.startWeakens(this.targetServer.hostname, threads);

          if (requiredWeakens <= 0) {
            break;
          }
        }
        this.ns.print('Growing + weakening, and sleeping for ' + sleepTime);
      } else {
        this.ns.print('Growing and sleeping for ' + sleepTime);
      }

      await this.ns.sleep(sleepTime);
      return;
    }
  }
}
