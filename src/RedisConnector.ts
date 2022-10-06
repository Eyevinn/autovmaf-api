import { createClient } from 'redis';

export class RedisConnector {
  private redisClient: any;

  constructor() {
    this.redisClient = createClient();
    this.redisClient.on('error', (err: any) => {
      console.error('RedisConnector error ' + err);
    });
    this.redisClient.connect();
  }

  public async get(key: string): Promise<string> {
    return await this.redisClient.get(key);
  }

  public async set(key: string, value: string): Promise<void> {
    await this.redisClient.set(key, value);
  }

  public async delete(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.redisClient.del(key, (err: any, reply: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
