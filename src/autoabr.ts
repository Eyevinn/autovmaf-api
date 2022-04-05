import { createJob as createAutoABRJob } from '@eyevinn/autoabr';
import { S3, GetObjectCommand } from '@aws-sdk/client-s3';

export default class AutoABR {
  private async streamToString(stream: any): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let responseDataChunks = []  as  any;
      stream.Body.once('error', err => reject(err));
      stream.Body.on('data', chunk => responseDataChunks.push(chunk));
      stream.Body.once('end', () => resolve(responseDataChunks.join('')));
    });
  }
  
  public async downloadFromS3(S3url: string) {
    const s3 = new S3({ region: (process.env.AWS_REGION || 'eu-north-1') });
    console.log('Bucket: ' + S3url.split('/')[2] + ' Key: ' + S3url.split('/')[3]);
    const getCommand = new GetObjectCommand({ Bucket: S3url.split('/')[2], Key: S3url.split('/')[3] });
    const response = await s3.send(getCommand);
    return await this.streamToString(response);
  }

  public async createJob(jobData: any, pipelineData: any, encodingProfileData: any) {
    console.log('Creating job...');
    createAutoABRJob(jobData, pipelineData, encodingProfileData);
  }
}
