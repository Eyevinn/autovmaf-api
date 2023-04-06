import { createClient } from 'redis';

export namespace RedisConnector {
  let redisClient: any;

 

  export function getInstance() {
    if (!redisClient) {
      redisClient = createClient();
      redisClient.on('error', (err: any) => {
        console.error('RedisConnector error ' + err);
      });
      redisClient.connect();
    }
    return redisClient
  }

  export async function get(key: string): Promise<string> {
    return await redisClient.get(key);
  }

  export async function set(key: string, value: string): Promise<void> {
    await redisClient.set(key, value);
  }

  export async function deleteEntity(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      redisClient.del(key, (err: any, reply: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
