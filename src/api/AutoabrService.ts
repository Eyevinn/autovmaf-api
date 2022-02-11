import Fastify from "fastify";
import AutoABR from '../autoabr';

export class AutoabrService {
  private fastify: any;
  private autoabr: AutoABR;

  constructor() {
    this.autoabr = new AutoABR();
    this.fastify = Fastify({ logger: true });
  }

  private async routes() {
    this.fastify.get("/healthcheck", async (request, reply) => {
      reply
        .code(200)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send({ status: "Healthy 💖" });
    });

    this.fastify.post('/create-job', async (request, reply) => {
      if (!request.body.jobData) {
        reply.code(400).send({ error: 'Missing jobData' });
        return;
      }
      if (!request.body.pipelineData) {
        reply.code(400).send({ error: 'Missing pipelineData' });
        return;
      }
      if (!request.body.encodingProfileData) {
        reply.code(400).send({ error: 'Missing encodingProfileData' });
        return;
      }
      const jobData = request.body.jobData;
      const pipelineData = request.body.pipelineData;
      const encodingProfileData = request.body.encodingProfileData;
      this.autoabr.createJob(jobData, pipelineData, encodingProfileData);
      reply
      .code(200)
      .header('Content-Type', 'application/json; charset=utf-8')
      .send({ status: 'ok' });
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