import Fastify from "fastify";
import { AutoABR, State } from '../autoabr';
import { default_pipeline } from '../resources/pipelines';
import { default_profile } from '../resources/profiles';

export class AutoabrService {
  private fastify: any;
  private autoabrClients = [];

  constructor() {
    this.fastify = Fastify({ logger: true });
  }

  private getAutoabrClient(id?: string) {
    if (id) return this.autoabrClients.find(client => client.id === id);
    if (this.autoabrClients.length < 1) {
      this.autoabrClients = [new AutoABR()];
      this.autoabrClients[0].status = State.IDLE;
      return this.autoabrClients[0];
    }
    for (let i = 0; i < this.autoabrClients.length; i++) {
      if (this.autoabrClients[i].status === State.INACTIVE) {
        this.autoabrClients[i].status = State.IDLE;
        return this.autoabrClients[i];
      }
    }
    this.autoabrClients.push(new AutoABR());
    this.autoabrClients[this.autoabrClients.length - 1].status = State.IDLE;
    return this.autoabrClients[this.autoabrClients.length - 1];
  }

  private async routes() {
    this.fastify.get("/healthcheck", async (request, reply) => {
      reply
        .code(200)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send({ status: "Healthy 💖" });
    });

    this.fastify.post('/create-job', async (request, reply) => {
      if (!request.body.job) {
        reply.code(400).send({ error: 'Missing job parameter' });
        return;
      }

      const job = request.body.job;
      let pipelineS3Url = request.body['pipelineUrl'];
      let encodingS3Url = request.body['encodingSettingsUrl'];
      let mediaConvertProfile = default_profile;
      let pipeline = default_pipeline;
      const autoabrClient = this.getAutoabrClient();
      try {
        if (pipelineS3Url) {
          pipeline = JSON.parse(await autoabrClient.downloadFromS3(pipelineS3Url));
        }
        if (encodingS3Url) {
          mediaConvertProfile = JSON.parse(await autoabrClient.downloadFromS3(encodingS3Url));
        }
      } catch (error) {
        console.error(error);
        reply
        .code(500)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send({ Message: 'Failed to load settings from S3' });
      }

      autoabrClient.createJob(job, pipeline, mediaConvertProfile);
      reply
      .code(200)
      .header('Content-Type', 'application/json; charset=utf-8')
      .send({ 
        Message: 'Job created successfully! 🎞️',
        Id: autoabrClient.id,
      });
    });

    this.fastify.get('/job/:id', async (request, reply) => {
      const id = request.params.id;
      const autoabrClient = this.getAutoabrClient(id);
      if (!autoabrClient) {
        reply
        .code(404)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send({ Message: 'Job not found' });
        return;
      }
      reply
      .code(200)
      .header('Content-Type', 'application/json; charset=utf-8')
      .send({
        Id: autoabrClient.id,
        Status: autoabrClient.status,
        Timer: autoabrClient.getJobTimer(),
      });
    });
  }

  async listen(port: number) {
    await this.routes();
    this.fastify.listen(port, (err, address) => {
      if (err) {
        console.error(err);
        throw err;
      }
      console.log(`Server is now listening on ${address}`);
    });
  }
}