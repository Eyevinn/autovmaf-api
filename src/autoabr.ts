import { createJob as createAutoABRJob } from '@eyevinn/autoabr';

export default class AutoABR {
  private parseResolutions(resolutions: any[]): any {
    return resolutions.map(resolution => {
      const [width, height] = resolution.split('x');
      return { width: parseInt(width), height: parseInt(height) };
    });
  }
  
  public async createJob(jobData: any, pipelineData: any, encodingProfileData: any) {
    createAutoABRJob(jobData, pipelineData, encodingProfileData);
  }
}
