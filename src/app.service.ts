import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from "@nestjs/config";
import {ethers, JsonRpcProvider, JsonRpcSigner, Wallet} from "ethers";
import BandOracleReaderABI from './abi/BandOracleReader.json'

@Injectable()
export class AppService {
    private readonly logger = new Logger(AppService.name)
    public readonly provider: JsonRpcProvider
    private readonly signer: Wallet | JsonRpcSigner

    constructor(
      private configService: ConfigService,
    ) {
        const rpcUrl = configService.get('rpcUrl')
        const privateKey = configService.get('privateKey')
        const contractAddresses = configService.get('contractAddresses')

        if(!rpcUrl) {
            this.logger.error(`RPC_URL is empty, exit`)
            process.exit(1)
        }

        if(!privateKey) {
            this.logger.error(`PRIVATE_KEY is empty, exit`)
            process.exit(1)
        }

        if(contractAddresses.length === 0) {
            this.logger.error(`BAND_CONTRACT_ADDRESSES is empty, exit`)
            process.exit(1)
        }

        try {
            this.provider = new JsonRpcProvider(rpcUrl)
            this.signer = new ethers.Wallet(privateKey, this.provider)
        } catch (e) {
            this.logger.error(`Failed to init wallet: ${e.message}, exit`)
            process.exit(1)
        }

        this.logger.log(`Bot started with address ${this.signer.address}`)
        this.runLoop()
    }

    async runLoop() {
        const updateInterval = this.configService.get('updateIntervalSeconds')
        try {
            await this.executeUpdates()
        } catch (e) {
            this.logger.error('Failed to run update loop: ', e)
        } finally {
            await new Promise(resolve => setTimeout(resolve, updateInterval * 1000))
            this.runLoop()
        }
    }

    async executeUpdates() {
        const contractAddresses = this.configService.get('contractAddresses')
        this.logger.log(`Executing pullDataAndCache, contracts addresses count: ${contractAddresses.length}`)

        for(let i=0; i < contractAddresses.length; i++) {
            const contractAddress = contractAddresses[i]
            try {
                this.logger.log(`Updating BandOracleReader ${contractAddress}, signer address: ${this.signer.address}...`)
                const contract = new ethers.Contract(contractAddress, BandOracleReaderABI, this.signer)
                const receipt = await contract.pullDataAndCache()
                this.logger.log(`${contractAddress} successfully updated, txn hash: ${receipt.hash}`)
            } catch (e) {
                this.logger.error(`Failed to update contract ${contractAddress}:`, e.message)
            }
        }
    }
}
