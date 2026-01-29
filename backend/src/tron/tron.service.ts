import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
const TronWeb = require("tronweb");

@Injectable()
export class TronService {
  private tronWeb: any;
  private readonly fullHost: string;
  private readonly eventServer: string;
  private readonly solidityNode: string;

  constructor(private readonly config: ConfigService) {
    this.fullHost = this.config.get<string>("TRON_FULLNODE") || "https://api.trongrid.io";
    this.eventServer = this.config.get<string>("TRON_EVENT_SERVER") || this.fullHost;
    this.solidityNode = this.config.get<string>("TRON_SOLIDITY_NODE") || this.fullHost;
    this.tronWeb = this.createClient();
  }

  async generateWallet() {
    try {
      const account = await this.tronWeb.createAccount();
      return {
        address: account.address.base58,
        privateKey: account.privateKey,
      };
    } catch (err: any) {
      const message = err?.message || "Failed to generate TRON wallet";
      throw new Error(message);
    }
  }

  getClient() {
    return this.tronWeb;
  }

  createClient(privateKey?: string) {
    return new TronWeb({
      fullHost: this.fullHost,
      eventServer: this.eventServer,
      solidityNode: this.solidityNode,
      privateKey,
    });
  }

  async sendTrx(fromPrivateKey: string, toAddress: string, amountTrx: number) {
    const client = this.createClient(fromPrivateKey);
    const amountSun = Math.round(amountTrx * 1_000_000);
    return client.trx.sendTransaction(toAddress, amountSun);
  }

  async sendUsdt(fromPrivateKey: string, toAddress: string, amountUsdt: number, contract: string) {
    const client = this.createClient(fromPrivateKey);
    const contractInstance = await client.contract().at(contract);
    const amount = Math.round(amountUsdt * 1_000_000);
    return contractInstance.transfer(toAddress, amount).send();
  }
}
