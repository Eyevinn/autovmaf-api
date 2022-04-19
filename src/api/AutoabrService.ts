import Fastify from 'fastify';
import { AutoABR, State } from '../AutoABR';
import { default_pipeline } from '../resources/pipelines';
import { default_profile } from '../resources/profiles';

export class AutoabrService {
  private fastify: any;
  private autoabrWorkers = [];

  constructor() {
    this.fastify = Fastify({
      logger: true,
      ignoreTrailingSlash: true,
    });
  }

  private getAutoabrWorker(id?: string): AutoABR {
    if (id) return this.autoabrWorkers.find((client) => client.id === id);
    for (let i = 0; i < this.autoabrWorkers.length; i++) {
      if (this.autoabrWorkers[i].status === State.INACTIVE) {
        this.autoabrWorkers[i].status = State.IDLE;
        return this.autoabrWorkers[i];
      }
    }
    this.autoabrWorkers.push(new AutoABR());
    this.autoabrWorkers[this.autoabrWorkers.length - 1].status = State.IDLE;
    return this.autoabrWorkers[this.autoabrWorkers.length - 1];
  }

  private getAllAutoabrWorkers(): {} {
    let clients = {};
    if (this.autoabrWorkers.length < 1) return clients;
    for (let i = 0; i < this.autoabrWorkers.length; i++) {
      clients[`worker_${i}`] = {
        id: this.autoabrWorkers[i].id,
        status: this.autoabrWorkers[i].status,
        jobOutput: this.autoabrWorkers[i].jobOutput,
        runningTime: this.autoabrWorkers[i].getJobTimer(),
      };
    }
    return clients;
  }

  private async routes() {
    this.fastify.get('/', async (request, reply) => {
      reply
        .code(200)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send({ status: 'Healthy 💖' });
    });

    this.fastify.post('/autoabr', async (request, reply) => {
      if (!request.body.job) {
        reply.code(400).send({ error: 'Missing job parameter' });
        return;
      }

      const job = request.body.job;
      const pipelineS3Url = request.body['pipelineUrl'];
      const encodingS3Url = request.body['encodingSettingsUrl'];
      const autoabrWorker = this.getAutoabrWorker();
      let mediaConvertProfile = default_profile;
      let pipeline = default_pipeline;

      try {
        if (pipelineS3Url) {
          pipeline = JSON.parse(await autoabrWorker.downloadFromS3(pipelineS3Url));
        }
        if (encodingS3Url) {
          mediaConvertProfile = JSON.parse(await autoabrWorker.downloadFromS3(encodingS3Url));
        }
      } catch (error) {
        console.error(error);
        reply
          .code(500)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send({ message: 'Failed to load settings from S3' });
      }

      autoabrWorker.createJob(job, pipeline, mediaConvertProfile);
      reply
        .code(200)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send({
          id: autoabrWorker.id,
          status: autoabrWorker.status,
          jobOutput: autoabrWorker.jobOutput,
          runningTime: autoabrWorker.getJobTimer(),
        });
    });

    this.fastify.get('/autoabr', async (request, reply) => {
      reply
        .code(200)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send(this.getAllAutoabrWorkers());
    });

    this.fastify.get('/autoabr/:id/', async (request, reply) => {
      const id = request.params.id;
      const autoabrWorker = this.getAutoabrWorker(id);
      if (!autoabrWorker) {
        reply
          .code(404)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send({ message: `Autoabr worker with id: ${id} could not be found` });
      }
      reply
        .code(200)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send({
          id: autoabrWorker.id,
          status: autoabrWorker.status,
          jobOutput: autoabrWorker.jobOutput,
          runningTime: autoabrWorker.getJobTimer(),
        });
    });

    this.fastify.get('/autoabr/result/:output', async (request, reply) => {
      const output = request.params.output;
      const autoabrWorker = this.getAutoabrWorker();
      try {
        const result = await autoabrWorker.getJobOutput(output);
        reply
          .code(200)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send({
            id: autoabrWorker.id,
            status: autoabrWorker.status,
            result: result,
          });
      } catch (error) {
        reply
          .code(500)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send({
            id: autoabrWorker.id,
            status: autoabrWorker.status,
            message: 'Failed to load results from S3' 
          });
      }
    });
  }

  /**
    * Start the server
    * @param {number} port - The port
    * @param {string} host - The host (ip) address (Optional)
    */
  async listen(port: number, host?: string) {
    await this.routes();
    this.fastify.listen(port, host, (err, address) => {
      if (err) {
        console.error(err);
        throw err;
      }
      console.log(`Server is now listening on ${address}`);
    });
  }
}
